import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { hashPassword, randomId, sha256, verifyPassword } from "./crypto";
import { readStore, updateStore } from "./store";
import { createClient as createSupabaseServerClient, isSupabaseAuthConfigured } from "./supabase/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { PublicUser, Role, User } from "./types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[6-9]\d{9}$/;

export function sanitizeUser(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    demo: user.demo,
    suspended: user.suspended,
    favouriteChargerIds: user.favouriteChargerIds,
    savedLocations: user.savedLocations,
  };
}

export async function currentUser() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const profile = await readStore((store) => store.users.find((item) => item.authUserId === data.user.id));
      if (profile && !profile.suspended) return sanitizeUser(profile);
      return null;
    }
  }

  const jar = await cookies();
  const token = jar.get("vc_session")?.value;
  if (!token) return null;
  const tokenHash = sha256(token);
  return readStore((store) => {
    const now = new Date().toISOString();
    const session = store.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > now);
    if (!session) return null;
    const user = store.users.find((item) => item.id === session.userId);
    if (!user || user.suspended) return null;
    return sanitizeUser(user);
  });
}

export async function verifiedSupabaseUser() {
  if (!isSupabaseAuthConfigured()) throw new HttpError(503, "Supabase Auth is not configured.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Verify your phone number to continue.");
  if (!data.user.phone || !data.user.phone_confirmed_at) throw new HttpError(403, "A verified phone number is required.");
  return data.user;
}

export async function syncSupabaseHost(authUser: SupabaseAuthUser, input: { name: string; email?: string }) {
  const digits = (authUser.phone ?? "").replace(/\D/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!PHONE.test(phone)) throw new HttpError(400, "Use a verified 10-digit Indian mobile number.");
  if (name.length < 2) throw new HttpError(400, "Enter your full name.");
  if (email && !EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address or leave it blank.");

  return updateStore((store) => {
    let profile = store.users.find((item) => item.authUserId === authUser.id || item.phone === phone);
    if (profile?.role === "admin") throw new HttpError(403, "Admin accounts cannot enroll as hosts.");
    if (email && store.users.some((item) => item.id !== profile?.id && item.email === email)) {
      throw new HttpError(409, "That email address is already associated with another account.");
    }

    if (profile) {
      profile.authUserId = authUser.id;
      profile.phone = phone;
      profile.name = name;
      profile.email = email;
      profile.role = "host";
      profile.demo = false;
      profile.suspended = false;
      return sanitizeUser(profile);
    }

    const credentials = hashPassword(randomId("supabase"));
    profile = {
      id: randomId("usr"),
      authUserId: authUser.id,
      role: "host",
      name,
      email,
      phone,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      suspended: false,
      demo: false,
      createdAt: new Date().toISOString(),
      favouriteChargerIds: [],
      savedLocations: [],
    };
    store.users.push(profile);
    return sanitizeUser(profile);
  });
}

export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "You do not have access to that action.");
  return user;
}

export async function setSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await updateStore((store) => {
    store.sessions = store.sessions.filter((item) => item.expiresAt > new Date().toISOString());
    store.sessions.push({ tokenHash: sha256(token), userId, expiresAt: expires });
  });
  const jar = await cookies();
  jar.set("vc_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const jar = await cookies();
  const token = jar.get("vc_session")?.value;
  if (token) {
    const tokenHash = sha256(token);
    await updateStore((store) => {
      store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
    });
  }
  jar.delete("vc_session");
}

export async function signup(input: { name: string; email: string; phone: string; password: string; role: Role }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (name.length < 2) throw new HttpError(400, "Enter your full name.");
  if (!EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!PHONE.test(phone)) throw new HttpError(400, "Enter a 10-digit Indian mobile number.");
  if (input.password.length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
  if (input.role !== "customer" && input.role !== "host") throw new HttpError(400, "Choose a driver or host account.");

  const { hash, salt } = hashPassword(input.password);
  const user: User = {
    id: randomId("usr"),
    role: input.role,
    name,
    email,
    phone,
    passwordHash: hash,
    passwordSalt: salt,
    suspended: false,
    demo: false,
    createdAt: new Date().toISOString(),
    favouriteChargerIds: [],
    savedLocations: [],
  };

  await updateStore((store) => {
    if (store.users.some((item) => item.email === email)) throw new HttpError(409, "An account with that email already exists.");
    if (store.users.some((item) => item.phone === phone)) throw new HttpError(409, "An account with that mobile number already exists.");
    store.users.push(user);
  });
  return sanitizeUser(user);
}

export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = await readStore((store) => store.users.find((item) => item.email === normalized));
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  if (user.suspended) throw new HttpError(403, "This account is suspended.");
  return sanitizeUser(user);
}

