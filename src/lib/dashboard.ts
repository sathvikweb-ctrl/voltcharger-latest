import { customerPrice } from "./catalog";
import { HttpError } from "./auth";
import { hashPassword, randomId } from "./crypto";
import { readStore, updateStore } from "./store";
import type { ListingStatus, PriceRow, PublicUser } from "./types";

export function customerDashboard(userId: string) {
  return readStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) throw new HttpError(404, "Account not found.");
    const bookings = store.bookings
      .filter((item) => item.customerId === userId)
      .map((booking) => {
        const charger = store.chargers.find((item) => item.id === booking.chargerId);
        const payment = store.payments.find((item) => item.bookingId === booking.id && item.status !== "created" && item.status !== "failed");
        return {
          ...booking,
          chargerName: charger ? `${charger.manufacturer} ${charger.model}` : "Charger",
          city: charger?.city,
          capacityKw: charger?.capacityKw,
          type: charger?.type,
          receiptNo: payment?.receiptNo ?? null,
          paymentStatus: payment?.status ?? null,
          paymentMode: payment?.mode ?? null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      bookings,
      favourites: user.favouriteChargerIds,
      savedLocations: user.savedLocations,
      reviews: store.reviews.filter((review) => review.userId === userId),
    };
  });
}

export function hostDashboard(userId: string) {
  return readStore((store) => {
    const chargers = store.chargers.filter((item) => item.hostId === userId);
    const ids = new Set(chargers.map((item) => item.id));
    const bookings = store.bookings.filter((item) => ids.has(item.chargerId));
    const payouts = store.payouts.filter((item) => item.hostId === userId);
    const completed = bookings.filter((item) => item.status === "completed");
    const gross = payouts.reduce((sum, item) => sum + (item.status === "reversed" ? 0 : item.gross), 0);
    const commission = payouts.reduce((sum, item) => sum + (item.status === "reversed" ? 0 : item.commission), 0);
    const net = payouts.reduce((sum, item) => sum + (item.status === "reversed" ? 0 : item.net), 0);
    const energy = completed.reduce((sum, item) => sum + (item.actualKwh ?? item.energyKwh), 0);
    return {
      chargers: chargers.map((charger) => ({
        ...charger,
        pricePerKwh: customerPrice(charger, store.settings).pricePerKwh,
        accountNumberStored: false,
      })),
      bookings: bookings.map((booking) => {
        const customer = store.users.find((item) => item.id === booking.customerId);
        const charger = chargers.find((item) => item.id === booking.chargerId);
        return {
          ...booking,
          customerName: customer?.name ?? "Driver",
          customerPhone: booking.contactShared ? customer?.phone ?? null : null,
          chargerName: charger ? `${charger.manufacturer} ${charger.model}` : "Charger",
        };
      }),
      payouts,
      stats: {
        totalBookings: bookings.length,
        upcoming: bookings.filter((item) => item.status === "confirmed" || item.status === "awaiting_host").length,
        completed: completed.length,
        energyKwh: Math.round(energy * 10) / 10,
        gross,
        commission,
        net,
      },
      manualConfirmation: store.settings.manualConfirmation,
      commissionRate: store.settings.commissionRate,
    };
  });
}

export function adminOverview() {
  return readStore((store) => ({
    users: store.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      suspended: user.suspended,
      demo: user.demo,
    })),
    chargers: store.chargers.map((charger) => ({
      id: charger.id,
      hostId: charger.hostId,
      status: charger.status,
      manufacturer: charger.manufacturer,
      model: charger.model,
      type: charger.type,
      capacityKw: charger.capacityKw,
      city: charger.city,
      rejectionReason: charger.rejectionReason ?? "",
      requestedCustomPrice: charger.requestedCustomPrice,
      customPriceApproved: charger.customPriceApproved,
      demo: charger.demo,
      verification: charger.verification,
    })),
    bookings: store.bookings,
    payments: store.payments.map((payment) => ({ ...payment, sandboxToken: undefined })),
    payouts: store.payouts,
    complaints: store.complaints,
    settings: store.settings,
    stats: {
      customers: store.users.filter((user) => user.role === "customer").length,
      hosts: store.users.filter((user) => user.role === "host").length,
      pending: store.chargers.filter((charger) => charger.status === "pending").length,
      approved: store.chargers.filter((charger) => charger.status === "approved").length,
      bookings: store.bookings.length,
    },
  }));
}

export function setChargerStatus(id: string, status: ListingStatus, reason?: string) {
  return updateStore((store) => {
    const charger = store.chargers.find((item) => item.id === id);
    if (!charger) throw new HttpError(404, "Charger not found.");
    charger.status = status;
    if (status === "rejected") charger.rejectionReason = reason?.trim() || "Application rejected.";
    if (status === "approved") charger.rejectionReason = undefined;
    if (status === "unavailable") charger.bookingsDisabled = true;
    if (status === "approved") charger.bookingsDisabled = false;
    return charger;
  });
}

export function updateSettings(patch: {
  commissionRate?: number;
  platformFee?: number;
  gstRate?: number;
  manualConfirmation?: boolean;
  pricing?: PriceRow[];
}) {
  return updateStore((store) => {
    if (patch.commissionRate != null) {
      if (patch.commissionRate < 0 || patch.commissionRate > 0.4) throw new HttpError(400, "Commission must be between 0% and 40%.");
      store.settings.commissionRate = patch.commissionRate;
    }
    if (patch.platformFee != null) {
      if (patch.platformFee < 0 || patch.platformFee > 500) throw new HttpError(400, "Platform fee must be between ₹0 and ₹500.");
      store.settings.platformFee = patch.platformFee;
    }
    if (patch.gstRate != null) {
      if (patch.gstRate < 0 || patch.gstRate > 0.28) throw new HttpError(400, "GST rate looks invalid.");
      store.settings.gstRate = patch.gstRate;
    }
    if (patch.manualConfirmation != null) store.settings.manualConfirmation = patch.manualConfirmation;
    if (patch.pricing) {
      if (!patch.pricing.length) throw new HttpError(400, "The price list cannot be empty.");
      for (const row of patch.pricing) {
        if ((row.type !== "AC" && row.type !== "DC") || !(row.capacityKw > 0) || !(row.pricePerKwh > 0)) {
          throw new HttpError(400, "Each price row needs a type, kW capacity, and a price per kWh.");
        }
      }
      store.settings.pricing = patch.pricing;
    }
    return store.settings;
  });
}

export function suspendUser(userId: string, suspended: boolean) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) throw new HttpError(404, "User not found.");
    if (user.role === "admin") throw new HttpError(400, "The admin account cannot be suspended here.");
    user.suspended = suspended;
    if (suspended) store.sessions = store.sessions.filter((session) => session.userId !== userId);
    return { id: user.id, suspended: user.suspended };
  });
}

export function deleteHostAccount(userId: string) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.role !== "host") throw new HttpError(404, "Host account not found.");
    const hostChargerIds = new Set(store.chargers.filter((charger) => charger.hostId === userId).map((charger) => charger.id));
    const now = Date.now();
    const hasUpcomingBooking = store.bookings.some((booking) => {
      if (!hostChargerIds.has(booking.chargerId)) return false;
      const end = new Date(`${booking.date}T${booking.end}:00+05:30`).getTime();
      return end > now && ["pending_payment", "awaiting_host", "confirmed"].includes(booking.status);
    });
    if (hasUpcomingBooking) {
      throw new HttpError(409, "Cancel or complete upcoming bookings before deleting your host account.");
    }

    const oldPhone = user.phone;
    for (const charger of store.chargers) {
      if (charger.hostId !== userId) continue;
      charger.status = "unavailable";
      charger.bookingsDisabled = true;
      charger.bank = null;
      charger.verification = [];
    }
    for (const review of store.reviews) {
      if (review.userId === userId) review.author = "Former user";
    }
    const credentials = hashPassword(randomId("closed"));
    user.name = "Deleted host";
    user.email = `deleted-${user.id}@deleted.invalid`;
    user.phone = "";
    user.passwordHash = credentials.hash;
    user.passwordSalt = credentials.salt;
    user.suspended = true;
    user.favouriteChargerIds = [];
    user.savedLocations = [];
    store.sessions = store.sessions.filter((session) => session.userId !== userId);
    store.otps = store.otps.filter((otp) => otp.phone !== oldPhone);
    return { deleted: true };
  });
}

export function approveCustomPrice(chargerId: string, approved: boolean) {
  return updateStore((store) => {
    const charger = store.chargers.find((item) => item.id === chargerId);
    if (!charger) throw new HttpError(404, "Charger not found.");
    if (approved) {
      if (!charger.requestedCustomPrice) throw new HttpError(400, "The host did not request a custom price.");
      charger.customPricePerKwh = charger.requestedCustomPrice;
      charger.customPriceApproved = true;
    } else {
      charger.customPriceApproved = false;
      charger.customPricePerKwh = null;
    }
    return charger;
  });
}

export function addComplaint(userId: string, message: string, bookingId?: string) {
  if (message.trim().length < 8) throw new HttpError(400, "Describe the issue in a sentence or two.");
  return updateStore((store) => {
    const complaint = {
      id: `cmp_${Math.random().toString(16).slice(2, 10)}`,
      userId,
      bookingId,
      message: message.trim(),
      status: "open" as const,
      createdAt: new Date().toISOString(),
    };
    store.complaints.push(complaint);
    return complaint;
  });
}

export function resolveComplaint(id: string) {
  return updateStore((store) => {
    const complaint = store.complaints.find((item) => item.id === id);
    if (!complaint) throw new HttpError(404, "Complaint not found.");
    complaint.status = "resolved";
    return complaint;
  });
}

export function toggleFavourite(userId: string, chargerId: string) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    const charger = store.chargers.find((item) => item.id === chargerId && item.status === "approved");
    if (!user || !charger) throw new HttpError(404, "Charger not found.");
    if (user.favouriteChargerIds.includes(chargerId)) {
      user.favouriteChargerIds = user.favouriteChargerIds.filter((id) => id !== chargerId);
    } else user.favouriteChargerIds.push(chargerId);
    return user.favouriteChargerIds;
  });
}

export function saveLocation(userId: string, input: { label: string; city: string; pin: string; lat: number; lng: number }) {
  if (input.label.trim().length < 2) throw new HttpError(400, "Name this place.");
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user) throw new HttpError(404, "Account not found.");
    user.savedLocations.push({
      id: `loc_${Math.random().toString(16).slice(2, 10)}`,
      label: input.label.trim(),
      city: input.city.trim(),
      pin: input.pin.trim(),
      lat: input.lat,
      lng: input.lng,
    });
    return user.savedLocations;
  });
}

export function addReview(userId: string, input: { bookingId: string; rating: number; comment: string }) {
  if (input.rating < 1 || input.rating > 5) throw new HttpError(400, "Choose a rating from 1 to 5.");
  if (input.comment.trim().length < 4) throw new HttpError(400, "Write a short review.");
  return updateStore((store) => {
    const booking = store.bookings.find((item) => item.id === input.bookingId && item.customerId === userId);
    if (!booking || booking.status !== "completed") throw new HttpError(400, "You can review a charger after a completed session.");
    if (store.reviews.some((review) => review.bookingId === booking.id)) throw new HttpError(409, "You already reviewed this session.");
    const author = store.users.find((item) => item.id === userId);
    const review = {
      id: `rv_${Math.random().toString(16).slice(2, 10)}`,
      chargerId: booking.chargerId,
      bookingId: booking.id,
      userId,
      author: author?.name.split(" ")[0] ?? "Driver",
      rating: input.rating,
      comment: input.comment.trim(),
      createdAt: new Date().toISOString(),
      verified: true,
    };
    store.reviews.push(review);
    return review;
  });
}

export function updateHostCharger(hostId: string, chargerId: string, patch: {
  rules?: string;
  parking?: boolean;
  indoor?: boolean;
  open?: string;
  close?: string;
  days?: number[];
  bookingsDisabled?: boolean;
  installationNotes?: string;
}) {
  return updateStore((store) => {
    const charger = store.chargers.find((item) => item.id === chargerId && item.hostId === hostId);
    if (!charger) throw new HttpError(404, "Charger not found.");
    if (patch.rules != null) charger.rules = patch.rules.slice(0, 400);
    if (patch.parking != null) charger.parking = patch.parking;
    if (patch.indoor != null) charger.indoor = patch.indoor;
    if (patch.installationNotes != null) charger.installationNotes = patch.installationNotes.slice(0, 400);
    if (patch.days) charger.days = patch.days;
    if (patch.open && patch.close) {
      if (patch.open >= patch.close) throw new HttpError(400, "Closing time must be after opening time.");
      charger.open = patch.open;
      charger.close = patch.close;
    }
    if (patch.bookingsDisabled != null) {
      charger.bookingsDisabled = patch.bookingsDisabled;
      charger.status = patch.bookingsDisabled ? "unavailable" : charger.status === "unavailable" ? "approved" : charger.status;
    }
    return charger;
  });
}

export function recordRefund(bookingId: string) {
  return updateStore((store) => {
    const payment = store.payments.find((item) => item.bookingId === bookingId);
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!payment || !booking) throw new HttpError(404, "Payment not found.");
    payment.status = "refund_recorded";
    if (booking.status !== "completed") booking.status = "cancelled";
    booking.adjustmentNote = "Admin recorded a refund in sandbox mode. No bank transfer was sent.";
    return payment;
  });
}
