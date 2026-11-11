export type Role = "customer" | "host" | "admin";
export type ChargerType = "AC" | "DC";
export type ListingStatus = "pending" | "approved" | "rejected" | "unavailable";
export type BookingStatus =
  | "pending_payment"
  | "awaiting_host"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed";
export type PaymentStatus = "created" | "verified" | "failed" | "refund_recorded";
export type Phase = "single" | "three" | "na";

export interface PriceRow {
  type: ChargerType;
  capacityKw: number;
  pricePerKwh: number;
}

export interface User {
  id: string;
  authUserId?: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  suspended: boolean;
  demo: boolean;
  createdAt: string;
  favouriteChargerIds: string[];
  savedLocations: SavedLocation[];
}

export interface SavedLocation {
  id: string;
  label: string;
  city: string;
  pin: string;
  lat: number;
  lng: number;
}

export interface Charger {
  id: string;
  hostId: string;
  status: ListingStatus;
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
  publicLat: number;
  publicLng: number;
  parking: boolean;
  indoor: boolean;
  photos: string[];
  days: number[];
  open: string;
  close: string;
  minDurationMin: number;
  maxDurationMin: number;
  advanceDays: number;
  bookingsDisabled: boolean;
  customPricePerKwh: number | null;
  customPriceApproved: boolean;
  requestedCustomPrice: number | null;
  rules: string;
  meteringSupported: boolean;
  demo: boolean;
  createdAt: string;
  rejectionReason?: string;
  verification: VerificationMeta[];
  bank: { accountName: string; last4: string; ifsc: string } | null;
}

export interface VerificationMeta {
  kind: "government_id" | "ownership" | "charger_photo" | "installation" | "safety";
  fileName: string;
  size: number;
  stored: false;
  note: string;
}

export interface Review {
  id: string;
  chargerId: string;
  bookingId: string;
  userId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  verified: boolean;
}

export interface Booking {
  id: string;
  chargerId: string;
  customerId: string;
  date: string;
  start: string;
  end: string;
  energyKwh: number;
  actualKwh: number | null;
  ratePerKwh: number;
  energyAmount: number;
  platformFee: number;
  tax: number;
  total: number;
  estimatedMinutes: number;
  vehicleLimitKw: number;
  status: BookingStatus;
  contactShared?: boolean;
  meteringSupported: boolean;
  amountLabel: string;
  createdAt: string;
  holdExpiresAt?: string;
  cancelReason?: string;
  adjustment: number;
  adjustmentNote: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  orderId: string;
  amount: number;
  currency: "INR";
  status: PaymentStatus;
  mode: "sandbox" | "razorpay";
  method?: string;
  sandboxToken?: string;
  receiptNo?: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface Payout {
  id: string;
  hostId: string;
  bookingId: string;
  gross: number;
  commissionRate: number;
  commission: number;
  net: number;
  status: "scheduled" | "paid" | "reversed";
  createdAt: string;
}

export interface Complaint {
  id: string;
  userId: string;
  bookingId?: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export interface Otp {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: string;
  verifiedToken?: string;
  consumed: boolean;
}

export interface Settings {
  commissionRate: number;
  platformFee: number;
  gstRate: number;
  manualConfirmation: boolean;
  pricing: PriceRow[];
}

export interface Store {
  users: User[];
  chargers: Charger[];
  bookings: Booking[];
  payments: Payment[];
  payouts: Payout[];
  reviews: Review[];
  complaints: Complaint[];
  sessions: Session[];
  otps: Otp[];
  settings: Settings;
}

export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  demo: boolean;
  suspended: boolean;
  favouriteChargerIds: string[];
  savedLocations: SavedLocation[];
}

export interface PublicCharger {
  id: string;
  hostId: string;
  hostName: string;
  status: ListingStatus;
  manufacturer: string;
  model: string;
  type: ChargerType;
  capacityKw: number;
  connector: string;
  connectorCount: number;
  phase: Phase;
  maxOutputKw: number;
  city: string;
  state: string;
  pinArea: string;
  publicLat: number;
  publicLng: number;
  parking: boolean;
  indoor: boolean;
  photos: string[];
  days: number[];
  open: string;
  close: string;
  minDurationMin: number;
  maxDurationMin: number;
  advanceDays: number;
  bookingsDisabled: boolean;
  pricePerKwh: number;
  priceSource: "platform" | "admin_custom";
  rules: string;
  meteringSupported: boolean;
  demo: boolean;
  rating: number | null;
  reviewCount: number;
  distanceKm?: number;
  availableNow: boolean;
  address?: string;
  lat?: number;
  lng?: number;
  exactLocationVisible: boolean;
}
