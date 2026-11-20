import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { env } from "./env";
import { COOKIE, decodeSession, type Session } from "./session";
import { db } from "./supabase";

export type TeacherSession = Extract<Session, { role: "teacher" }>;

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value, env.sessionSecret);
}

/** For pages: send anyone without the right role to the sign-in page. */
export async function pageSession<R extends Session["role"]>(...roles: R[]): Promise<Extract<Session, { role: R }>> {
  const s = await getSession();
  if (!s || !roles.includes(s.role as R)) redirect("/login");
  return s as Extract<Session, { role: R }>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * For API routes that use the cookie. Also blocks cross-site requests: the
 * browser's Origin header must match this site.
 */
export async function apiSession<R extends Session["role"]>(...roles: R[]): Promise<Extract<Session, { role: R }>> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked");
  const s = await getSession();
  if (!s || !roles.includes(s.role as R)) throw new HttpError(401, "Please sign in again");
  return s as Extract<Session, { role: R }>;
}

export function hashKey(key: string) {
  return createHash("sha256").update(key.trim()).digest("hex");
}

function bearer(h: Headers): string {
  const auth = h.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

/** Claude Code key (stored hashed in api_keys). Returns the key id. */
export async function requireClaudeCodeKey(h: Headers): Promise<string> {
  const key = bearer(h);
  if (!key) throw new HttpError(401, "Missing key");
  const { data } = await db().from("api_keys").select("id").eq("key_hash", hashKey(key)).eq("revoked", false).maybeSingle();
  if (!data) throw new HttpError(401, "Invalid or revoked key");
  await db().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.id as string;
}

export function requireIntegrationToken(h: Headers) {
  const expected = env.integrationToken;
  const given = bearer(h);
  if (!expected || !given) throw new HttpError(401, "Integration is not set up");
  if (hashKey(given) !== hashKey(expected)) throw new HttpError(401, "Invalid token");
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
