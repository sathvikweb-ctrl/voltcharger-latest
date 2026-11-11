import { randomId } from "./crypto";
import { customerPrice, overlaps, slotsFor } from "./catalog";
import { HttpError } from "./auth";
import {
  addDays,
  CANCELLATION_POLICY,
  estimateBooking,
  minutesToTime,
  timeToMinutes,
  todayIso,
  weekdayIndex,
} from "./pricing";
import { readStore, updateStore } from "./store";
import type { Booking, PublicUser } from "./types";

export interface QuoteInput {
  chargerId: string;
  date: string;
  start: string;
  energyKwh: number;
  vehicleLimitKw?: number;
}

export interface CreateBookingInput extends QuoteInput {
  shareContact?: boolean;
}

function assertQuoteShape(input: QuoteInput) {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(input.date)) throw new HttpError(400, "Choose a valid date.");
  if (!/^\d{2}:\d{2}$/.test(input.start)) throw new HttpError(400, "Choose a start time.");
  if (!Number.isFinite(input.energyKwh) || input.energyKwh < 1 || input.energyKwh > 150) {
    throw new HttpError(400, "Request between 1 and 150 kWh.");
  }
}

export async function quoteBooking(input: QuoteInput) {
  assertQuoteShape(input);
  return readStore(async (store) => {
    const charger = store.chargers.find((item) => item.id === input.chargerId);
    if (!charger || charger.status !== "approved" || charger.bookingsDisabled) {
      throw new HttpError(404, "That charger is not available for booking.");
    }
    const vehicleLimit = input.vehicleLimitKw && input.vehicleLimitKw > 0 ? input.vehicleLimitKw : charger.capacityKw;
    const price = customerPrice(charger, store.settings);
    let estimate;
    try {
      estimate = estimateBooking({
        energyKwh: input.energyKwh,
        pricePerKwh: price.pricePerKwh,
        capacityKw: charger.capacityKw,
        vehicleLimitKw: vehicleLimit,
        platformFee: store.settings.platformFee,
        gstRate: store.settings.gstRate,
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not price this booking.");
    }
    const reserveMinutes = Math.max(estimate.estimatedMinutes, charger.minDurationMin);
    if (reserveMinutes > charger.maxDurationMin) {
      throw new HttpError(400, `This session is longer than the host's maximum of ${charger.maxDurationMin} minutes. Request less energy.`);
    }
    const slots = await slotsFor(charger.id, input.date, reserveMinutes);
    const slot = slots.find((item) => item.start === input.start);
    if (!slot) throw new HttpError(409, "That time is no longer available. Choose another slot.");
    const amountLabel = charger.meteringSupported
      ? "Estimated charging amount. The final session amount is based on measured kWh after the session."
      : "Estimated charging amount. The host confirms the energy delivered after the session.";
    return {
      chargerId: charger.id,
      date: input.date,
      start: slot.start,
      end: slot.end,
      energyKwh: input.energyKwh,
      ratePerKwh: price.pricePerKwh,
      capacityKw: charger.capacityKw,
      type: charger.type,
      vehicleLimitKw: vehicleLimit,
      efficiency: 0.9,
      ...estimate,
      reserveMinutes,
      meteringSupported: charger.meteringSupported,
      amountLabel,
      cancellationPolicy: CANCELLATION_POLICY,
      commissionNote: "Platform commission is deducted from the host payout. It is not added on top of your total.",
    };
  });
}

export async function createBooking(user: PublicUser, input: CreateBookingInput) {
  const quote = await quoteBooking(input);
  const booking = await updateStore((store) => {
    const charger = store.chargers.find((item) => item.id === input.chargerId);
    if (!charger) throw new HttpError(404, "Charger not found.");
    const clash = store.bookings.some((item) => {
      const blocking =
        item.status === "confirmed" ||
        item.status === "awaiting_host" ||
        (item.status === "pending_payment" && item.holdExpiresAt && item.holdExpiresAt > new Date().toISOString());
      return blocking && overlaps(item, quote.date, quote.start, quote.end) && item.chargerId === charger.id;
    });
    if (clash) throw new HttpError(409, "That slot was just reserved. Pick another time.");
    const created: Booking = {
      id: randomId("bk"),
      chargerId: charger.id,
      customerId: user.id,
      date: quote.date,
      start: quote.start,
      end: quote.end,
      energyKwh: quote.energyKwh,
      actualKwh: null,
      ratePerKwh: quote.ratePerKwh,
      energyAmount: quote.energyAmount,
      platformFee: quote.platformFee,
      tax: quote.tax,
      total: quote.total,
      estimatedMinutes: quote.estimatedMinutes,
      vehicleLimitKw: quote.vehicleLimitKw,
      status: store.settings.manualConfirmation ? "awaiting_host" : "confirmed",
      contactShared: input.shareContact === true,
      meteringSupported: quote.meteringSupported,
      amountLabel: quote.amountLabel,
      createdAt: new Date().toISOString(),
      adjustment: 0,
      adjustmentNote: "",
    };
    store.bookings.push(created);
    return created;
  });
  return { booking, quote };
}

export function cancelBooking(user: PublicUser, bookingId: string, reason: string) {
  return updateStore((store) => {
    const booking = store.bookings.find((item) => item.id === bookingId && item.customerId === user.id);
    if (!booking) throw new HttpError(404, "Booking not found.");
    if (booking.status === "cancelled" || booking.status === "rejected" || booking.status === "completed") {
      throw new HttpError(400, "This booking can no longer be cancelled.");
    }
    const start = new Date(`${booking.date}T${booking.start}:00+05:30`).getTime();
    if (Date.now() >= start) throw new HttpError(400, "The slot has started, so it cannot be cancelled.");
    const hoursUntil = (start - Date.now()) / 36e5;
    booking.status = "cancelled";
    booking.cancelReason = reason.trim() || "Cancelled by driver";
    const payment = store.payments.find((item) => item.bookingId === booking.id && item.status === "verified");
    if (payment && hoursUntil < 2) {
      payment.status = "refund_recorded";
      booking.adjustmentNote = "Inside the 2-hour window. Energy charge is refund-due. Platform fee is kept. Sandbox mode only records this.";
    } else if (payment) {
      payment.status = "refund_recorded";
      booking.adjustmentNote = "Free cancellation. A full refund is recorded in sandbox mode and is not sent to a bank.";
    }
    const payout = store.payouts.find((item) => item.bookingId === booking.id);
    if (payout && payout.status !== "paid") payout.status = "reversed";
    return booking;
  });
}

export function completeBooking(hostId: string, bookingId: string, actualKwh: number) {
  if (!Number.isFinite(actualKwh) || actualKwh < 0 || actualKwh > 200) {
    throw new HttpError(400, "Enter the actual energy supplied in kWh.");
  }
  return updateStore((store) => {
    const booking = store.bookings.find((item) => item.id === bookingId);
    const charger = booking && store.chargers.find((item) => item.id === booking.chargerId);
    if (!booking || !charger || charger.hostId !== hostId) throw new HttpError(404, "Booking not found.");
    if (booking.status !== "confirmed") throw new HttpError(400, "Only a confirmed booking can be completed.");
    booking.actualKwh = Math.round(actualKwh * 100) / 100;
    booking.status = "completed";
    const actualEnergy = Math.round(booking.actualKwh * booking.ratePerKwh * 100) / 100;
    booking.adjustment = Math.round((actualEnergy - booking.energyAmount) * 100) / 100;
    if (booking.meteringSupported) {
      booking.amountLabel = "Final charging amount is based on the metered kWh entered by the host.";
      booking.adjustmentNote = booking.adjustment === 0
        ? "Metered energy matches the estimate."
        : `Metered difference of ₹${booking.adjustment} recorded against the estimate.`;
    } else {
      booking.amountLabel = "Host-confirmed charging amount. This session was not automatically metered.";
      booking.adjustmentNote = "The host confirmed the energy. This is not an automatic meter reading.";
    }
    const gross = actualEnergy;
    const commission = Math.round(gross * store.settings.commissionRate * 100) / 100;
    store.payouts.push({
      id: randomId("po"),
      hostId,
      bookingId: booking.id,
      gross,
      commissionRate: store.settings.commissionRate,
      commission,
      net: Math.round((gross - commission) * 100) / 100,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    });
    return booking;
  });
}

export function decideBooking(hostId: string, bookingId: string, accept: boolean) {
  return updateStore((store) => {
    if (!store.settings.manualConfirmation) throw new HttpError(400, "Manual confirmation is turned off.");
    const booking = store.bookings.find((item) => item.id === bookingId);
    const charger = booking && store.chargers.find((item) => item.id === booking.chargerId);
    if (!booking || !charger || charger.hostId !== hostId) throw new HttpError(404, "Booking not found.");
    if (booking.status !== "awaiting_host") throw new HttpError(400, "This booking is not waiting for a host decision.");
    if (accept) {
      booking.status = "confirmed";
      return booking;
    }
    booking.status = "rejected";
    booking.cancelReason = "Host declined the request";
    const payment = store.payments.find((item) => item.bookingId === booking.id && item.status === "verified");
    if (payment) payment.status = "refund_recorded";
    booking.adjustmentNote = "Host declined. A refund is recorded in sandbox mode.";
    return booking;
  });
}

export function hostCanUseDate(chargerDays: number[], date: string, advanceDays: number) {
  const weekday = weekdayIndex(date);
  const today = todayIso();
  return weekday != null && chargerDays.includes(weekday) && date >= today && date <= addDays(today, advanceDays);
}

export { minutesToTime };
