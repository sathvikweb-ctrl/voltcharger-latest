import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string) {
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function randomDigits(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

export function publicCoordinate(lat: number, lng: number, id: string) {
  const digest = createHash("sha256").update(id).digest();
  const dx = (digest[0] / 255 - 0.5) * 0.005;
  const dy = (digest[1] / 255 - 0.5) * 0.005;
  return {
    publicLat: Math.round((lat + dx) * 1e6) / 1e6,
    publicLng: Math.round((lng + dy) * 1e6) / 1e6,
  };
}
