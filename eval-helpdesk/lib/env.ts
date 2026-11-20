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

function list(v: string | undefined): string[] {
  return (v || "").split(",").map((e) => e.trim()).filter(Boolean);
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
  /** Password for the developer who runs the evaluation app's Claude Code (Fixes page only). */
  get developerPassword() { return process.env.DEVELOPER_PASSWORD || ""; },
  /** Public address of this helpdesk, used in emails and GitHub issues. */
  get appUrl() { return (process.env.APP_URL || "").replace(/\/$/, ""); },
  /** Email alerts (optional): Resend API key and sender. */
  get resendKey() { return process.env.RESEND_API_KEY || ""; },
  get emailFrom() { return process.env.EMAIL_FROM || "Parthu Helpdesk <onboarding@resend.dev>"; },
  /** Who hears about a new change waiting for review (comma separated). */
  get ownerEmails() { return list(process.env.OWNER_EMAILS); },
  /** Who hears about an approved fix: the person running the app's Claude Code. */
  get developerEmails() { return list(process.env.DEVELOPER_EMAILS); },
  /** GitHub issues (optional): fine-grained token with Issues read/write on ONE repo, and that repo. */
  get githubToken() { return process.env.GITHUB_ISSUES_TOKEN || ""; },
  get githubRepo() { return process.env.GITHUB_REPO || ""; }, // "owner/name"
  get githubMentionClaude() { return process.env.GITHUB_MENTION_CLAUDE === "true"; },
  get model() { return process.env.CLAUDE_MODEL || "claude-opus-5-5"; },
  /** Messages a teacher may send per hour. */
  get hourlyLimit() { return Number(process.env.TEACHER_HOURLY_LIMIT || 30); },
};
