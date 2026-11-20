import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSession, encodeSession, hashAccessCode, newAccessCode, safeEqual } from "../lib/session";

const SECRET = "x".repeat(40);

test("round-trips a valid session", () => {
  const token = encodeSession({ role: "owner", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  assert.equal(decodeSession(token, SECRET)?.role, "owner");
});

test("rejects a tampered session (teacher trying to become owner)", () => {
  const token = encodeSession({ role: "teacher", tid: "t1", name: "A", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  const [, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ role: "owner", exp: 9999999999 })).toString("base64url") + "." + mac;
  assert.equal(decodeSession(forged, SECRET), null);
});

test("rejects a session signed with another secret", () => {
  const token = encodeSession({ role: "owner", exp: Math.floor(Date.now() / 1000) + 60 }, "y".repeat(40));
  assert.equal(decodeSession(token, SECRET), null);
});

test("rejects an expired session", () => {
  const token = encodeSession({ role: "owner", exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  assert.equal(decodeSession(token, SECRET), null);
});

test("access codes are readable, unique and case-insensitive to check", () => {
  const a = newAccessCode();
  assert.match(a, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.notEqual(a, newAccessCode());
  assert.equal(hashAccessCode(a.toLowerCase()), hashAccessCode(a));
});

test("safeEqual", () => {
  assert.ok(safeEqual("correct horse", "correct horse"));
  assert.ok(!safeEqual("correct horse", "correct horsf"));
});
