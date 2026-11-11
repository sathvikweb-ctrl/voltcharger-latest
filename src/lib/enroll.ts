import { HttpError } from "./auth";
import { publicCoordinate, randomId } from "./crypto";
import { connectorsFor, lookupPrice } from "./pricing";
import { updateStore } from "./store";
import type { Charger, ChargerType, Phase, PublicUser, VerificationMeta } from "./types";

const PHONE = /^[6-9]\d{9}$/;

export interface EnrollInput {
  fullName: string;
  phone: string;
  email: string;
  manufacturer: string;
  model: string;
  type: ChargerType;
  capacityKw: number;
  connector: string;
  connectorCount: number;
  phase: Phase;
  installationNotes: string;
  maxOutputKw: number;
  address: string;
  city: string;
  state: string;
  pin: string;
  lat: number;
  lng: number;
  parking: boolean;
  indoor: boolean;
  photos: string[];
  days: number[];
  open: string;
  close: string;
  minDurationMin: number;
  maxDurationMin: number;
  advanceDays: number;
  requestedCustomPrice: number | null;
  documents: { kind: VerificationMeta["kind"]; fileName: string; size: number }[];
  bank: { accountName: string; accountNumber: string; ifsc: string };
}

export async function enrollCharger(user: PublicUser, input: EnrollInput) {
  if (user.role === "admin") throw new HttpError(403, "Admin accounts cannot enroll a charger.");
  if (!PHONE.test(input.phone)) throw new HttpError(400, "Enter a valid mobile number.");
  if (input.phone !== user.phone) throw new HttpError(403, "Use the verified phone number on your host account.");
  if (input.manufacturer.trim().length < 2 || input.model.trim().length < 1) {
    throw new HttpError(400, "Enter the charger manufacturer and model.");
  }
  if (input.type !== "AC" && input.type !== "DC") throw new HttpError(400, "Choose AC Slow or DC Fast.");
  if (!connectorsFor(input.type).includes(input.connector)) {
    throw new HttpError(400, "That connector does not match the charger type.");
  }
  if (input.connectorCount < 1 || input.connectorCount > 8) throw new HttpError(400, "Enter between 1 and 8 connectors.");
  if (input.type === "AC" && input.phase !== "single" && input.phase !== "three") {
    throw new HttpError(400, "AC chargers need a single-phase or three-phase supply.");
  }
  if (input.type === "DC") input.phase = "na";
  if (input.address.trim().length < 8 || input.city.trim().length < 2 || !/^\d{6}$/.test(input.pin)) {
    throw new HttpError(400, "Enter a full address, city, and 6-digit PIN code.");
  }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    throw new HttpError(400, "Drop a pin on the map so the charger has a location.");
  }
  if (!input.days.length || input.days.some((day) => day < 0 || day > 6)) throw new HttpError(400, "Choose at least one available day.");
  if (!/^\d{2}:\d{2}$/.test(input.open) || !/^\d{2}:\d{2}$/.test(input.close) || input.open >= input.close) {
    throw new HttpError(400, "Closing time must be after opening time.");
  }
  if (input.minDurationMin < 15 || input.maxDurationMin > 720 || input.minDurationMin > input.maxDurationMin) {
    throw new HttpError(400, "Check the minimum and maximum booking duration.");
  }
  if (input.advanceDays < 0 || input.advanceDays > 60) throw new HttpError(400, "Advance booking can be from 0 to 60 days.");
  const required = ["government_id", "ownership", "charger_photo", "installation"] as const;
  for (const kind of required) {
    if (!input.documents.some((doc) => doc.kind === kind && doc.fileName)) {
      throw new HttpError(400, "Add identity, ownership, charger, and installation documents.");
    }
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.bank.ifsc.toUpperCase())) throw new HttpError(400, "Enter a valid IFSC code.");
  if (!/^\d{9,18}$/.test(input.bank.accountNumber)) throw new HttpError(400, "Enter the account number. Only the last 4 digits are stored.");
  if (input.bank.accountName.trim().length < 2) throw new HttpError(400, "Enter the account holder name.");
  if (input.photos.some((photo) => photo.length > 280_000)) throw new HttpError(400, "Use smaller charger photos. Identity documents are not uploaded.");

  return updateStore((store) => {
    const price = lookupPrice(input.type, input.capacityKw, store.settings.pricing);
    if (price == null) throw new HttpError(400, "That capacity is not on the platform price list for the selected type.");
    if (input.maxOutputKw <= 0 || input.maxOutputKw > input.capacityKw) {
      throw new HttpError(400, "Maximum output cannot exceed the selected capacity.");
    }
    const id = randomId("ch");
    const approx = publicCoordinate(input.lat, input.lng, id);
    const charger: Charger = {
      id,
      hostId: user.id,
      status: "pending",
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      type: input.type,
      capacityKw: input.capacityKw,
      connector: input.connector,
      connectorCount: input.connectorCount,
      phase: input.type === "DC" ? "na" : input.phase,
      installationNotes: input.installationNotes.trim(),
      maxOutputKw: input.maxOutputKw,
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pin: input.pin,
      lat: input.lat,
      lng: input.lng,
      ...approx,
      parking: input.parking,
      indoor: input.indoor,
      photos: input.photos.slice(0, 3),
      days: input.days,
      open: input.open,
      close: input.close,
      minDurationMin: input.minDurationMin,
      maxDurationMin: input.maxDurationMin,
      advanceDays: input.advanceDays,
      bookingsDisabled: false,
      customPricePerKwh: null,
      customPriceApproved: false,
      requestedCustomPrice: input.requestedCustomPrice,
      rules: "Exact address is shared only after a confirmed booking.",
      meteringSupported: input.type === "DC",
      demo: false,
      createdAt: new Date().toISOString(),
      verification: input.documents.map((doc) => ({
        kind: doc.kind,
        fileName: doc.fileName.slice(0, 120),
        size: doc.size,
        stored: false as const,
        note: "File bytes were not stored. Connect a document vault and KYC provider before production.",
      })),
      bank: {
        accountName: input.bank.accountName.trim(),
        last4: input.bank.accountNumber.slice(-4),
        ifsc: input.bank.ifsc.toUpperCase(),
      },
    };
    store.chargers.push(charger);
    const account = store.users.find((item) => item.id === user.id);
    if (account && account.role === "customer") account.role = "host";
    return {
      id: charger.id,
      status: charger.status,
      message: "Your charger has been submitted successfully. Our team will review your application.",
      pricePerKwh: price,
    };
  });
}
