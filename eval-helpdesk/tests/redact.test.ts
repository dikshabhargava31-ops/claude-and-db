import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, redactDeep } from "../lib/redact";

const SAMPLES: Array<[string, string]> = [
  ["anthropic", "my key is sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"],
  ["openai", "OPENAI sk-proj-AbCdEfGhIjKlMnOpQrStUv123"],
  ["supabase jwt", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuv"],
  ["supabase new", "sb_secret_AbCdEfGhIjKlMnOp1234"],
  ["google", "AIzaSyA1234567890abcdefghijklmnopqrstuv"],
  ["github", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"],
  ["aws", "AKIAABCDEFGHIJKLMNOP"],
  ["db url", "postgres://postgres:SuperSecret123@db.abc.supabase.co:5432/postgres"],
  ["env line", "SUPABASE_SERVICE_ROLE_KEY=whatever-value-here"],
  ["json", '{"apiKey": "plainvalue123456"}'],
  ["bearer", "Authorization: Bearer abcdefghijklmnop1234567890"],
];

for (const [name, text] of SAMPLES) {
  test(`redacts ${name}`, () => {
    const out = redact(text);
    assert.match(out, /REDACTED/, out);
    for (const secret of ["AbCdEfGhIjKlMnOp", "SuperSecret123", "whatever-value-here", "plainvalue123456", "abcdefghijklmnop1234567890", "AKIAABCDEFGHIJKLMNOP", "eyJyb2xl"]) {
      assert.ok(!out.includes(secret), `${name} leaked: ${out}`);
    }
  });
}

test("leaves normal marking text alone", () => {
  const text = "Q5 is an MCQ. Student wrote B, key says B, awarded 0/1. Total should be 63 not 62. Copy ID CA-2026-0412.";
  assert.equal(redact(text), text);
});

test("redactDeep drops secret-named fields and scrubs nested strings", () => {
  const out = redactDeep({ copy_ref: "X1", api_key: "short", nested: [{ note: "key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv" }], marks: 4 });
  assert.equal(out.api_key, "[REDACTED]");
  assert.equal(out.marks, 4);
  assert.match(out.nested[0].note, /REDACTED/);
});
