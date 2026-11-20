// Removes anything that looks like a credential before text is stored, sent to
// Claude, shown to anyone, or exported to Claude Code. Applied on the way IN
// (teacher messages, copy data from the app) and on the way OUT (Claude's
// replies and change-log entries), so a key pasted by mistake never travels on.

const RULES: Array<[RegExp, string]> = [
  // PEM private keys
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  // Anthropic, OpenAI and similar "sk-" keys
  [/\bsk-(?:ant-)?[A-Za-z0-9_\-]{16,}/g, "[REDACTED API KEY]"],
  // Supabase new-style keys
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_\-]{10,}/g, "[REDACTED SUPABASE KEY]"],
  // JWTs (Supabase anon/service-role keys, session tokens)
  [/\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}/g, "[REDACTED TOKEN]"],
  // Google / Gemini / Firebase API keys
  [/\bAIza[0-9A-Za-z_\-]{30,}/g, "[REDACTED API KEY]"],
  // GitHub tokens
  [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g, "[REDACTED GITHUB TOKEN]"],
  // AWS access key ids
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[REDACTED AWS KEY]"],
  // Slack, Stripe, Vercel, Resend, Twilio-style tokens
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, "[REDACTED TOKEN]"],
  [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED KEY]"],
  [/\bvercel_[A-Za-z0-9]{20,}/gi, "[REDACTED TOKEN]"],
  [/\bre_[A-Za-z0-9]{20,}/g, "[REDACTED KEY]"],
  // Passwords inside connection strings: scheme://user:password@host
  [/\b([a-z][a-z0-9+.\-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi, "$1[REDACTED]@"],
  // Bearer / Basic auth headers
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=\-]{16,}/g, "$1 [REDACTED]"],
  // KEY=value / "secret": "value" style lines from .env files or JSON
  [
    /\b([A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|SERVICE_ROLE|ACCESS_KEY|DATABASE_URL)[A-Z0-9_]*)(["']?\s*[:=]\s*["']?)[^\s"',}]{6,}/gi,
    "$1$2[REDACTED]",
  ],
];

export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}

/** Redacts every string inside a JSON-like value (objects, arrays, nested). */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Drop fields whose NAME says they are secret, whatever the value looks like.
      if (/(api_?key|secret|token|password|service_role|credential)/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as T;
  }
  return value;
}
