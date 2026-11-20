import "server-only";

// Every secret this app uses lives in server-side environment variables
// (Vercel → Project → Settings → Environment Variables). None of them is
// prefixed NEXT_PUBLIC_, so Next.js never ships them to the browser, and none
// of them is ever placed in a prompt sent to Claude.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get supabaseUrl() { return required("SUPABASE_URL"); },
  get supabaseServiceKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return s;
  },
  get ownerPassword() {
    const s = required("OWNER_PASSWORD");
    if (s.length < 12) throw new Error("OWNER_PASSWORD must be at least 12 characters");
    return s;
  },
  /** Bearer token the evaluation app uses to push copy snapshots (optional). */
  get integrationToken() { return process.env.INTEGRATION_TOKEN || ""; },
  /** Bearer token Claude Code uses to read approved changes (optional). */
  get changesToken() { return process.env.CHANGES_TOKEN || ""; },
  get model() { return process.env.CLAUDE_MODEL || "claude-opus-5-5"; },
  /** Messages a teacher may send per hour. */
  get hourlyLimit() { return Number(process.env.TEACHER_HOURLY_LIMIT || 30); },
};
