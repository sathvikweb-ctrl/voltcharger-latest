import { haversineKm } from "./format";
import {
  addDays,
  CANCELLATION_POLICY,
  lookupPrice,
  minutesToTime,
  nowMinutesIst,
  timeToMinutes,
  todayIso,
  weekdayIndex,
} from "./pricing";
import { readStore } from "./store";
import type { Booking, Charger, PublicCharger, PublicUser, Settings } from "./types";

export function customerPrice(charger: Charger, settings: Settings) {
  if (charger.customPriceApproved && charger.customPricePerKwh) {
    return { pricePerKwh: charger.customPricePerKwh, priceSource: "admin_custom" as const };
  }
  const price = lookupPrice(charger.type, charger.capacityKw, settings.pricing);
  if (price == null) {
    throw new Error(`No platform price is configured for ${charger.capacityKw} kW ${charger.type}.`);
  }
  return { pricePerKwh: price, priceSource: "platform" as const };
}

function reviewsFor(store: { reviews: StoreReviews }, chargerId: string) {
  return store.reviews.filter((review) => review.chargerId === chargerId && review.verified);
}

type StoreReviews = { chargerId: string; verified: boolean; rating: number }[];

function activeBookings(bookings: Booking[], chargerId: string, now = new Date()) {
  return bookings.filter((booking) => {
    if (booking.chargerId !== chargerId) return false;
    if (booking.status === "confirmed" || booking.status === "awaiting_host" || booking.status === "completed") return true;
    if (booking.status === "pending_payment" && booking.holdExpiresAt && booking.holdExpiresAt > now.toISOString()) return true;
    return false;
  });
}

export function overlaps(booking: Pick<Booking, "date" | "start" | "end">, date: string, start: string, end: string) {
  if (booking.date !== date) return false;
  const a1 = timeToMinutes(booking.start);
  const a2 = timeToMinutes(booking.end);
  const b1 = timeToMinutes(start);
  const b2 = timeToMinutes(end);
  if (a1 == null || a2 == null || b1 == null || b2 == null) return true;
  return b1 < a2 && b2 > a1;
}

export function toPublicCharger(
  charger: Charger,
  settings: Settings,
  extras: {
    hostName: string;
    reviews: { rating: number }[];
    bookings: Booking[];
    origin?: { lat: number; lng: number };
    exact?: boolean;
  },
): PublicCharger {
  const price = customerPrice(charger, settings);
  const rating = extras.reviews.length
    ? Math.round((extras.reviews.reduce((sum, review) => sum + review.rating, 0) / extras.reviews.length) * 10) / 10
    : null;
  const distanceKm = extras.origin
    ? Math.round(haversineKm(extras.origin.lat, extras.origin.lng, charger.publicLat, charger.publicLng) * 10) / 10
    : undefined;
  const availableNow = isAvailableNow(charger, extras.bookings);
  return {
    id: charger.id,
    hostId: charger.hostId,
    hostName: extras.hostName,
    status: charger.status,
    manufacturer: charger.manufacturer,
    model: charger.model,
    type: charger.type,
    capacityKw: charger.capacityKw,
    connector: charger.connector,
    connectorCount: charger.connectorCount,
    phase: charger.phase,
    maxOutputKw: charger.maxOutputKw,
    city: charger.city,
    state: charger.state,
    pinArea: charger.pin,
    publicLat: charger.publicLat,
    publicLng: charger.publicLng,
    parking: charger.parking,
    indoor: charger.indoor,
    photos: charger.photos,
    days: charger.days,
    open: charger.open,
    close: charger.close,
    minDurationMin: charger.minDurationMin,
    maxDurationMin: charger.maxDurationMin,
    advanceDays: charger.advanceDays,
    bookingsDisabled: charger.bookingsDisabled,
    pricePerKwh: price.pricePerKwh,
    priceSource: price.priceSource,
    rules: charger.rules,
    meteringSupported: charger.meteringSupported,
    demo: charger.demo,
    rating,
    reviewCount: extras.reviews.length,
    distanceKm,
    availableNow,
    exactLocationVisible: Boolean(extras.exact),
    ...(extras.exact ? { address: charger.address, lat: charger.lat, lng: charger.lng } : {}),
  };
}

export function isAvailableNow(charger: Charger, bookings: Booking[], now = new Date()) {
  if (charger.status !== "approved" || charger.bookingsDisabled) return false;
  const date = todayIso(now);
  const weekday = weekdayIndex(date);
  if (weekday == null || !charger.days.includes(weekday)) return false;
  const open = timeToMinutes(charger.open);
  const close = timeToMinutes(charger.close);
  const minute = nowMinutesIst(now);
  if (open == null || close == null || minute < open || minute >= close) return false;
  const probeEnd = minutesToTime(Math.min(close, minute + 30));
  const probeStart = minutesToTime(minute);
  return !activeBookings(bookings, charger.id, now).some((booking) => overlaps(booking, date, probeStart, probeEnd));
}

export function searchChargers(query: {
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  type?: string;
  minKw?: number;
  maxKw?: number;
  maxPrice?: number;
  connector?: string;
  availableNow?: boolean;
}) {
  return readStore((store) => {
    const origin = Number.isFinite(query.lat) && Number.isFinite(query.lng)
      ? { lat: query.lat as number, lng: query.lng as number }
      : undefined;
    const needle = query.q?.trim().toLowerCase();
    const rows = store.chargers
      .filter((charger) => charger.status === "approved" && !charger.bookingsDisabled)
      .map((charger) => {
        const host = store.users.find((user) => user.id === charger.hostId);
        return toPublicCharger(charger, store.settings, {
          hostName: host?.name.split(" ")[0] ?? "Host",
          reviews: reviewsFor(store, charger.id),
          bookings: store.bookings,
          origin,
        });
      })
      .filter((charger) => {
        if (needle && !`${charger.city} ${charger.state} ${charger.pinArea}`.toLowerCase().includes(needle)) return false;
        if (query.type && charger.type !== query.type) return false;
        if (query.connector && charger.connector !== query.connector) return false;
        if (query.minKw != null && charger.capacityKw < query.minKw) return false;
        if (query.maxKw != null && charger.capacityKw > query.maxKw) return false;
        if (query.maxPrice != null && charger.pricePerKwh > query.maxPrice) return false;
        if (query.availableNow && !charger.availableNow) return false;
        if (origin && query.radiusKm != null && (charger.distanceKm ?? Infinity) > query.radiusKm) return false;
        return true;
      });
    rows.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.pricePerKwh - b.pricePerKwh);
    return rows;
  });
}

export function getChargerForViewer(id: string, viewer: PublicUser | null) {
  return readStore((store) => {
    const charger = store.chargers.find((item) => item.id === id);
    if (!charger) return null;
    const host = store.users.find((user) => user.id === charger.hostId);
    const owns = viewer?.id === charger.hostId || viewer?.role === "admin";
    const booked = viewer
      ? store.bookings.some(
          (booking) =>
            booking.chargerId === id &&
            booking.customerId === viewer.id &&
            (booking.status === "confirmed" || booking.status === "completed"),
        )
      : false;
    if (charger.status !== "approved" && !owns) return null;
    const reviews = store.reviews.filter((review) => review.chargerId === id && review.verified);
    const publicCharger = toPublicCharger(charger, store.settings, {
      hostName: host?.name ?? "Host",
      reviews,
      bookings: store.bookings,
      exact: owns || booked,
    });
    return {
      charger: publicCharger,
      reviews: reviews.map((review) => ({
        id: review.id,
        author: review.author,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })),
      cancellationPolicy: CANCELLATION_POLICY,
      installationNotes: owns ? charger.installationNotes : undefined,
    };
  });
}

export function slotsFor(chargerId: string, date: string, reserveMinutes: number) {
  return readStore((store) => {
    const charger = store.chargers.find((item) => item.id === chargerId);
    if (!charger || charger.status !== "approved" || charger.bookingsDisabled) return [];
    const weekday = weekdayIndex(date);
    const open = timeToMinutes(charger.open);
    const close = timeToMinutes(charger.close);
    if (weekday == null || open == null || close == null || !charger.days.includes(weekday)) return [];
    const today = todayIso();
    if (date < today || date > addDays(today, charger.advanceDays)) return [];
    const duration = Math.max(reserveMinutes, charger.minDurationMin);
    if (duration > charger.maxDurationMin) return [];
    const now = new Date();
    const current = date === today ? nowMinutesIst(now) : -1;
    const taken = activeBookings(store.bookings, charger.id, now);
    const slots: { start: string; end: string }[] = [];
    for (let minute = open; minute + duration <= close; minute += 30) {
      if (minute <= current) continue;
      const start = minutesToTime(minute);
      const end = minutesToTime(minute + duration);
      if (taken.some((booking) => overlaps(booking, date, start, end))) continue;
      slots.push({ start, end });
    }
    return slots;
  });
}
