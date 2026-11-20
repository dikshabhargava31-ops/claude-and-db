import { createHmac, timingSafeEqual, createHash, randomBytes } from "node:crypto";

// Stateless signed session: base64url(JSON payload) + "." + HMAC-SHA256.
// The cookie is HttpOnly, Secure and SameSite=Lax, so page scripts can't read
// it and other sites can't send it on a cross-site POST.

export type Session =
  | { role: "teacher"; tid: string; name: string; exp: number }
  | { role: "owner"; exp: number };

export const COOKIE = "hd_session";
export const TEACHER_TTL_S = 60 * 60 * 12; // 12 h
export const OWNER_TTL_S = 60 * 60 * 8; // 8 h

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function encodeSession(s: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (typeof s.exp !== "number" || s.exp * 1000 < now) return null;
    if (s.role !== "teacher" && s.role !== "owner") return null;
    return s;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function hashAccessCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** 12 characters from an alphabet without look-alikes (0/O, 1/I/L): ~60 bits. */
export function newAccessCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}
