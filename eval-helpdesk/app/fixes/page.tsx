import Link from "next/link";
import { pageSession } from "../../lib/auth";
import { env } from "../../lib/env";
import { bySeverity, fixesToMarkdown, fixToMarkdown, type ChangeRow } from "../../lib/fixes";
import { db } from "../../lib/supabase";
import { CopyButton, MarkDoneButton } from "../../components/client";
import { StatusChip, TopBar } from "../../components/TopBar";

// The developer's page: approved fixes to make with Claude Code. No teacher
// reports, names or screenshots are shown here.
export default async function Fixes({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const s = await pageSession("owner", "developer");
  const showDone = (await searchParams).show === "done";
  const { data } = await db()
    .from("change_requests")
    .select("id, title, area, severity, evidence, suspected_cause, proposed_change, status, owner_note, created_at, decided_at, done_at, done_note, github_issue_url")
    .eq("status", showDone ? "done" : "approved")
    .limit(200);
  const rows = ((data ?? []) as ChangeRow[]).sort(bySeverity);
  return (
    <>
      <TopBar role={s.role} name={s.role === "owner" ? "Owner" : "Developer"} />
      <main>
        <h1>Fixes for the evaluation app</h1>
        <p className="muted">
          Approved by the owner. Paste one into Claude Code, or copy them all, or let Claude Code fetch them itself (“check the helpdesk”).
          Mark each one done when the fix is live.
        </p>
        <div className="tabs">
          <Link href="/fixes" className={showDone ? "" : "on"}>To do</Link>
          <Link href="/fixes?show=done" className={showDone ? "on" : ""}>Done</Link>
        </div>
        {!showDone && rows.length > 0 && (
          <div className="row" style={{ marginBottom: 12 }}>
            <CopyButton text={fixesToMarkdown(rows, env.appUrl)} label={`Copy all ${rows.length} for Claude Code`} />
            <a className="btn" href="/api/owner/export">Download as file</a>
          </div>
        )}
        {rows.length === 0 && <div className="card muted">{showDone ? "Nothing done yet." : "Nothing to fix right now."}</div>}
        {rows.map((c) => (
          <div key={c.id} className="card">
            <div className="row">
              <strong className="grow">{c.title}</strong>
              <StatusChip value={c.severity} /> <span className="chip">{c.area.replace(/_/g, " ")}</span>
            </div>
            <pre className="block">{fixToMarkdown(c, env.appUrl)}</pre>
            {c.done_note && <p><strong>What was changed:</strong> {c.done_note}</p>}
            {!showDone && (
              <div className="row">
                <CopyButton text={fixToMarkdown(c, env.appUrl)} />
                <MarkDoneButton id={c.id} />
                {c.github_issue_url && <a href={c.github_issue_url} target="_blank" rel="noreferrer">GitHub issue</a>}
              </div>
            )}
          </div>
        ))}
      </main>
    </>
  );
}
