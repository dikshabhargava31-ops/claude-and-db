import Link from "next/link";
import { pageSession } from "../../lib/auth";
import { db } from "../../lib/supabase";
import { StatusChip, TopBar } from "../../components/TopBar";

export default async function MyReports() {
  const s = await pageSession("teacher");
  const { data } = await db()
    .from("reports")
    .select("id, title, copy_ref, subject, status, updated_at")
    .eq("teacher_id", s.tid)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (
    <>
      <TopBar role="teacher" name={s.name} />
      <main>
        <div className="row"><h1 className="grow">My reports</h1><Link className="btn primary" href="/reports/new">Report a problem</Link></div>
        {(data ?? []).length === 0 && <div className="card muted">No reports yet. When the portal marks a copy wrongly, click “Report a problem”.</div>}
        {(data ?? []).map((r) => (
          <Link key={r.id} href={`/reports/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card">
              <div className="row"><strong className="grow">{r.title}</strong><StatusChip value={r.status} /></div>
              <div className="muted small">{[r.copy_ref && `Copy ${r.copy_ref}`, r.subject].filter(Boolean).join(" · ")} · {new Date(r.updated_at).toLocaleDateString("en-IN")}</div>
            </div>
          </Link>
        ))}
      </main>
    </>
  );
}
