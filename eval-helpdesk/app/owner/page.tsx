import Link from "next/link";
import { pageSession } from "../../lib/auth";
import { db } from "../../lib/supabase";
import { ChangeActions } from "../../components/client";
import { StatusChip, TopBar } from "../../components/TopBar";

const FILTERS = ["pending", "approved", "done", "rejected"] as const;

export default async function ChangeLog({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageSession("owner");
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const { data } = await db().from("change_requests").select("*").eq("status", status).order("created_at", { ascending: false }).limit(200);
  const { count: pending } = await db().from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return (
    <>
      <TopBar role="owner" name="Owner" />
      <main>
        <h1>Change log</h1>
        <p className="muted">Fixes the assistant thinks the evaluation app needs. Nothing changes in the app until you approve it, and then the developer makes the fix in Claude Code.</p>
        <div className="tabs">
          {FILTERS.map((f) => (
            <Link key={f} href={`/owner?status=${f}`} className={f === status ? "on" : ""}>
              {f[0].toUpperCase() + f.slice(1)}{f === "pending" && pending ? ` (${pending})` : ""}
            </Link>
          ))}
        </div>
        {(data ?? []).length === 0 && <div className="card muted">Nothing here.</div>}
        {(data ?? []).map((c) => (
          <div key={c.id} className="card">
            <div className="row">
              <strong className="grow">{c.title}</strong>
              <StatusChip value={c.severity} /> <span className="chip">{c.area.replace(/_/g, " ")}</span>
            </div>
            <div className="muted small">
              Logged {new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              {c.report_id && <> · <Link href={`/owner/reports/${c.report_id}`}>see the teacher's report</Link></>}
              {c.github_issue_url && <> · <a href={c.github_issue_url} target="_blank" rel="noreferrer">GitHub issue</a></>}
            </div>
            <h2>What happened</h2><div style={{ whiteSpace: "pre-wrap" }}>{c.evidence}</div>
            <h2>Likely cause</h2><div style={{ whiteSpace: "pre-wrap" }}>{c.suspected_cause}</div>
            {c.status !== "pending" && <><h2>Proposed change</h2><div style={{ whiteSpace: "pre-wrap" }}>{c.proposed_change}</div></>}
            {c.owner_note && <p><strong>Your note:</strong> {c.owner_note}</p>}
            {c.done_note && <p><strong>Developer's note:</strong> {c.done_note}</p>}
            <ChangeActions id={c.id} status={c.status} proposed={c.proposed_change} />
          </div>
        ))}
      </main>
    </>
  );
}
