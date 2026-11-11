import "server-only";
import fs from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "./crypto";
import { createSeed } from "./seed";
import type { Store } from "./types";

const file = path.join(process.cwd(), "data", "store.json");
const tableUrl = () => `${supabaseConfig()!.url.replace(/\/$/, "")}/rest/v1/vc_app_store`;

type StoreRow = { id: string; revision: number; store: Store };

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  if (!url) throw new Error("Set SUPABASE_URL to enable Supabase storage.");
  return { url, key };
}

async function supabaseFetch(url: string, init?: RequestInit) {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase storage is not configured.");
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase storage request failed (${response.status}).`);
  return response;
}

function removeDemoHostData(store: Store) {
  const demoHostIds = new Set(
    store.users
      .filter((user) => user.role === "host" && user.demo && (user.id === "usr_host_demo" || user.email.endsWith("@voltcharger.test")))
      .map((user) => user.id),
  );
  if (!demoHostIds.size) return false;

  const chargerIds = new Set(store.chargers.filter((charger) => demoHostIds.has(charger.hostId)).map((charger) => charger.id));
  const bookingIds = new Set(store.bookings.filter((booking) => chargerIds.has(booking.chargerId)).map((booking) => booking.id));
  const phones = new Set(store.users.filter((user) => demoHostIds.has(user.id)).map((user) => user.phone));
  store.users = store.users.filter((user) => !demoHostIds.has(user.id));
  store.chargers = store.chargers.filter((charger) => !chargerIds.has(charger.id));
  store.bookings = store.bookings.filter((booking) => !bookingIds.has(booking.id));
  store.payments = store.payments.filter((payment) => !bookingIds.has(payment.bookingId));
  store.payouts = store.payouts.filter((payout) => !demoHostIds.has(payout.hostId) && !bookingIds.has(payout.bookingId));
  store.reviews = store.reviews.filter((review) => !chargerIds.has(review.chargerId) && !bookingIds.has(review.bookingId));
  store.sessions = store.sessions.filter((session) => !demoHostIds.has(session.userId));
  store.otps = store.otps.filter((otp) => !phones.has(otp.phone));
  store.complaints = store.complaints.filter((complaint) => !demoHostIds.has(complaint.userId));
  for (const user of store.users) user.favouriteChargerIds = user.favouriteChargerIds.filter((id) => !chargerIds.has(id));
  return true;
}

function migrateAdminPassword(store: Store) {
  const admin = store.users.find((user) => user.id === "usr_admin_demo" && user.role === "admin");
  if (!admin || !verifyPassword("VoltAdmin#2026", admin.passwordHash, admin.passwordSalt)) return false;
  const credentials = hashPassword("siddu1508");
  admin.passwordHash = credentials.hash;
  admin.passwordSalt = credentials.salt;
  return true;
}

function loadLocal(): Store {
  if (!fs.existsSync(file)) {
    const seeded = createSeed();
    saveLocal(seeded);
    return seeded;
  }
  const store = JSON.parse(fs.readFileSync(file, "utf8")) as Store;
  const removedDemoHost = removeDemoHostData(store);
  const upgradedAdminPassword = migrateAdminPassword(store);
  if (removedDemoHost || upgradedAdminPassword) saveLocal(store);
  return store;
}

function saveLocal(store: Store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, file);
}

async function remoteRow(): Promise<StoreRow | null> {
  const query = new URLSearchParams({ id: "eq.main", select: "id,revision,store" });
  const response = await supabaseFetch(`${tableUrl()}?${query}`);
  const rows = (await response.json()) as StoreRow[];
  return rows[0] ?? null;
}

async function ensureRemoteRow(): Promise<StoreRow> {
  const existing = await remoteRow();
  if (existing) return existing;

  const initialStore = loadLocal();
  const insertUrl = new URL(tableUrl());
  insertUrl.searchParams.set("on_conflict", "id");
  await supabaseFetch(insertUrl.toString(), {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ id: "main", revision: 0, store: initialStore }),
  });

  const created = await remoteRow();
  if (!created) throw new Error("Supabase store was not initialized. Apply the vc_app_store migration first.");
  return created;
}

export async function readStore<T>(fn: (store: Store) => T): Promise<T> {
  if (!supabaseConfig()) return fn(loadLocal());
  const row = await ensureRemoteRow();
  return fn(row.store);
}

export async function updateStore<T>(fn: (store: Store) => T): Promise<T> {
  if (!supabaseConfig()) {
    const store = loadLocal();
    const result = fn(store);
    saveLocal(store);
    return result;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await ensureRemoteRow();
    const store = JSON.parse(JSON.stringify(row.store)) as Store;
    const result = fn(store);
    const query = new URLSearchParams({ id: "eq.main", revision: `eq.${row.revision}` });
    const response = await supabaseFetch(`${tableUrl()}?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ store, revision: row.revision + 1, updated_at: new Date().toISOString() }),
    });
    const updated = (await response.json()) as { id: string }[];
    if (updated.length) return result;
  }

  throw new Error("Supabase data changed too often to save this update. Please retry.");
}
