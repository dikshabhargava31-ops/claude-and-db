// Formats a change-log entry as plain instructions for Claude Code.
// Everything that passes through here has already been redacted on the way in,
// and is redacted again on the way out.
import { redact } from "./redact";

export type ChangeRow = {
  id: string;
  report_id: string | null;
  title: string;
  area: string;
  severity: string;
  evidence: string;
  suspected_cause: string;
  proposed_change: string;
  status: string;
  owner_note: string | null;
  created_at: string;
  decided_at: string | null;
  done_at?: string | null;
  done_note?: string | null;
  github_issue_url?: string | null;
};

export function fixToMarkdown(c: ChangeRow, appUrl = ""): string {
  const lines = [
    `## Fix ${c.id.slice(0, 8)}: ${c.title}`,
    "",
    `- **Area:** ${c.area.replace(/_/g, " ")}`,
    `- **Severity:** ${c.severity}`,
    `- **Approved:** ${c.decided_at ? c.decided_at.slice(0, 10) : "not yet"}`,
    "",
    "### What happened",
    c.evidence,
    "",
    "### Likely cause",
    c.suspected_cause,
    "",
    "### Proposed change",
    c.proposed_change,
  ];
  if (c.owner_note) lines.push("", "### Owner's note", c.owner_note);
  lines.push(
    "",
    "### When you make this fix",
    "- Find where this behaviour lives in the evaluation app and fix the cause, not just this one copy.",
    "- Add or update a test that reproduces the case above.",
    "- Do not change how API keys or other secrets are stored, and do not print them.",
    appUrl
      ? `- When done, mark it done: POST ${appUrl}/api/fixes/${c.id}/done with a short note of what you changed.`
      : "- When done, tell the owner so they can mark it done in the helpdesk.",
  );
  return redact(lines.join("\n"));
}

export function fixesToMarkdown(rows: ChangeRow[], appUrl = ""): string {
  if (rows.length === 0) return "# Approved fixes\n\nNothing waiting. All approved fixes are done.\n";
  return redact(
    `# Approved fixes (${rows.length})\n\nWork through these in order, most severe first.\n\n` +
      rows.map((r) => fixToMarkdown(r, appUrl)).join("\n\n---\n\n") + "\n",
  );
}

const ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function bySeverity(a: ChangeRow, b: ChangeRow) {
  return (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9) || a.created_at.localeCompare(b.created_at);
}
