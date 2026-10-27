// Private login: scrypt password hashes, random session tokens in an HttpOnly cookie,
// and per-workspace roles (owner, editor, viewer).
import crypto from "node:crypto";
import { newId } from "./store.js";

const SESSION_DAYS = 14;
const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function checkPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split("$");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 10) return "Use a password of at least 10 characters.";
  return null;
}

export function createUser(store, { email, name, password, admin = false }) {
  email = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw httpError(400, "Enter a valid email address.");
  const problem = validatePassword(password);
  if (problem) throw httpError(400, problem);
  if (store.all("users", (u) => u.email === email).length) throw httpError(409, "That email already has an account.");
  return store.insert("users", { id: newId("u_"), email, name: String(name || email).trim(), admin, passHash: hashPassword(password) });
}

export function createSession(store, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  // Only a hash of the token is stored, so a copy of the database can't be used to sign in.
  store.insert("sessions", { id: sha256(token), userId, expiresAt });
  return token;
}

export function sessionUser(store, token) {
  if (!token) return null;
  const s = store.get("sessions", sha256(token));
  if (!s) return null;
  if (s.expiresAt < new Date().toISOString()) {
    store.remove("sessions", s.id);
    return null;
  }
  return store.get("users", s.userId);
}

export function endSession(store, token) {
  if (token) store.remove("sessions", sha256(token));
}

export function roleIn(workspace, userId) {
  return workspace?.members?.find((m) => m.userId === userId)?.role || null;
}

export function requireRole(workspace, user, minRole) {
  const role = roleIn(workspace, user.id);
  if (!role) throw httpError(404, "Workspace not found.");
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw httpError(403, minRole === "owner" ? "Only the workspace owner can do this." : "Your role in this workspace is view-only.");
  }
  return role;
}

export function publicUser(u) {
  return u && { id: u.id, email: u.email, name: u.name, admin: !!u.admin };
}

export function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function httpError(status, message, extra = {}) {
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra);
  return e;
}

// Simple in-memory limiter for sign-in attempts.
const attempts = new Map();
export function loginAllowed(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60e3);
  attempts.set(key, list);
  return list.length < 10;
}
export function noteFailedLogin(key) {
  attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
}
