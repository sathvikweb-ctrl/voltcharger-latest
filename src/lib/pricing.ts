import type { ChargerType, PriceRow } from "./types";

/**
 * Official customer prices are per kWh.
 * 25 kW is ₹36 on purpose — do not "correct" it to sit between 20 and 30.
 * kW is charger output. kWh is energy the driver books.
 */
export const OFFICIAL_PRICES: PriceRow[] = [
  { type: "AC", capacityKw: 3.3, pricePerKwh: 23 },
  { type: "AC", capacityKw: 7.4, pricePerKwh: 25 },
  { type: "AC", capacityKw: 11, pricePerKwh: 28 },
  { type: "AC", capacityKw: 22, pricePerKwh: 32 },
  { type: "DC", capacityKw: 15, pricePerKwh: 35 },
  { type: "DC", capacityKw: 20, pricePerKwh: 37 },
  { type: "DC", capacityKw: 25, pricePerKwh: 36 },
  { type: "DC", capacityKw: 30, pricePerKwh: 38 },
  { type: "DC", capacityKw: 40, pricePerKwh: 40 },
  { type: "DC", capacityKw: 50, pricePerKwh: 43 },
  { type: "DC", capacityKw: 60, pricePerKwh: 45 },
  { type: "DC", capacityKw: 90, pricePerKwh: 47 },
  { type: "DC", capacityKw: 120, pricePerKwh: 50 },
  { type: "DC", capacityKw: 150, pricePerKwh: 55 },
  { type: "DC", capacityKw: 180, pricePerKwh: 60 },
  { type: "DC", capacityKw: 240, pricePerKwh: 65 },
  { type: "DC", capacityKw: 300, pricePerKwh: 70 },
  { type: "DC", capacityKw: 350, pricePerKwh: 75 },
];

export const AC_CONNECTORS = ["Type 2", "Bharat AC-001"];
export const DC_CONNECTORS = ["CCS2", "CHAdeMO", "GB/T", "Bharat DC-001"];

export const CANCELLATION_POLICY =
  "Bookings may be cancelled any time before the scheduled slot starts. Once the slot has started, it cannot be cancelled.";

export function connectorsFor(type: ChargerType) {
  return type === "AC" ? AC_CONNECTORS : DC_CONNECTORS;
}

export function capacitiesFor(type: ChargerType, rows: PriceRow[] = OFFICIAL_PRICES) {
  return rows.filter((row) => row.type === type).map((row) => row.capacityKw);
}

export function lookupPrice(type: ChargerType, capacityKw: number, rows: PriceRow[]) {
  const row = rows.find((item) => item.type === type && item.capacityKw === capacityKw);
  return row?.pricePerKwh ?? null;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateDurationMinutes(
  energyKwh: number,
  capacityKw: number,
  vehicleLimitKw = capacityKw,
  efficiency = 0.9,
) {
  const effectiveKw = Math.min(capacityKw, vehicleLimitKw) * efficiency;
  if (!(effectiveKw > 0) || !(energyKwh > 0)) {
    throw new Error("Energy and charger output must be greater than zero.");
  }
  return Math.ceil((energyKwh / effectiveKw) * 60);
}

export function estimateBooking(input: {
  energyKwh: number;
  pricePerKwh: number;
  capacityKw: number;
  vehicleLimitKw?: number;
  platformFee: number;
  gstRate: number;
}) {
  const energyAmount = roundMoney(input.energyKwh * input.pricePerKwh);
  const platformFee = roundMoney(input.platformFee);
  const tax = roundMoney(platformFee * input.gstRate);
  const total = roundMoney(energyAmount + platformFee + tax);
  const estimatedMinutes = estimateDurationMinutes(
    input.energyKwh,
    input.capacityKw,
    input.vehicleLimitKw ?? input.capacityKw,
  );
  return { energyAmount, platformFee, tax, total, estimatedMinutes };
}

export function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function weekdayIndex(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

export function todayIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function nowMinutesIst(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}
