import { hashPassword } from "./crypto";
import { OFFICIAL_PRICES } from "./pricing";
import type { Store, User } from "./types";

function user(input: {
  id: string;
  role: User["role"];
  name: string;
  email: string;
  phone: string;
  password: string;
  demo: boolean;
}): User {
  const { hash, salt } = hashPassword(input.password);
  return {
    id: input.id,
    role: input.role,
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: hash,
    passwordSalt: salt,
    suspended: false,
    demo: input.demo,
    createdAt: new Date().toISOString(),
    favouriteChargerIds: [],
    savedLocations: [],
  };
}

export function createSeed(): Store {
  const driver = user({
    id: "usr_driver_demo",
    role: "customer",
    name: "Rahul Menon",
    email: "driver@voltcharger.test",
    phone: "9123456780",
    password: "DriverDemo#2026",
    demo: true,
  });
  const admin = user({
    id: "usr_admin_demo",
    role: "admin",
    name: "VoltCharger Admin",
    email: "admin@voltcharger.test",
    phone: "9000000001",
    password: "siddu1508",
    demo: true,
  });

  return {
    users: [admin, driver],
    chargers: [],
    bookings: [],
    payments: [],
    payouts: [],
    reviews: [],
    complaints: [],
    sessions: [],
    otps: [],
    settings: {
      commissionRate: 0.12,
      platformFee: 0,
      gstRate: 0.18,
      manualConfirmation: false,
      pricing: OFFICIAL_PRICES.map((row) => ({ ...row })),
    },
  };
}
