import "server-only";
import { env } from "./env";
import { fixToMarkdown, type ChangeRow } from "./fixes";
import { redact } from "./redact";

// Outgoing notifications. Both are optional: if the variables are not set,
// nothing is sent and the helpdesk works the same.

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendEmail(to: string[], subject: string, text: string): Promise<void> {
  if (!env.resendKey || to.length === 0) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to,
      subject,
      text,
      html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    }),
  });
  if (!res.ok) console.error("Email failed", res.status, await res.text());
}

export async function notifyNewChange(c: ChangeRow) {
  const link = env.appUrl ? `${env.appUrl}/owner` : "the helpdesk owner page";
  await sendEmail(
    env.ownerEmails,
    `[Helpdesk] Review needed: ${c.title}`,
    redact(`A teacher's report points to a problem in the evaluation app's code.\n\n${c.title}\nSeverity: ${c.severity}\n\n${c.evidence}\n\nApprove or reject it here: ${link}`),
  );
}

export async function notifyApproved(c: ChangeRow) {
  const link = env.appUrl ? `${env.appUrl}/fixes` : "the helpdesk Fixes page";
  await sendEmail(
    env.developerEmails,
    `[Helpdesk] Fix approved: ${c.title}`,
    `A fix for the evaluation app has been approved.\n\nEither paste the text below into Claude Code, or open Claude Code on the evaluation app and say "check the helpdesk".\n\nAll fixes: ${link}\n\n----------------------------------------\n\n${fixToMarkdown(c, env.appUrl)}`,
  );
}

/** Opens a GitHub issue for an approved fix. Returns the issue URL, or null if GitHub is not set up. */
export async function openGithubIssue(c: ChangeRow): Promise<string | null> {
  if (!env.githubToken || !/^[\w.-]+\/[\w.-]+$/.test(env.githubRepo)) return null;
  const body =
    fixToMarkdown(c, env.appUrl) +
    (env.githubMentionClaude ? "\n\n@claude please fix this in a pull request, following the steps above." : "") +
    "\n\n_Opened by the Parthu evaluation helpdesk after owner approval._";
  const res = await fetch(`https://api.github.com/repos/${env.githubRepo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "eval-helpdesk",
    },
    body: JSON.stringify({ title: `[Helpdesk] ${c.title}`, body, labels: ["helpdesk"] }),
  });
  if (!res.ok) {
    console.error("GitHub issue failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { html_url?: string };
  return json.html_url ?? null;
}
