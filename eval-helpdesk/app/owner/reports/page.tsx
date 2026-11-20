import Link from "next/link";
import { pageSession } from "../../../lib/auth";
import { db } from "../../../lib/supabase";
import { StatusChip, TopBar } from "../../../components/TopBar";

export default async function AllReports() {
  await pageSession("owner");
  const { data } = await db()
    .from("reports")
    .select("id, title, copy_ref, subject, status, classification, updated_at, teachers(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  return (
    <>
      <TopBar role="owner" name="Owner" />
      <main>
        <h1>Teacher reports</h1>
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Report</th><th>Teacher</th><th>Copy</th><th>Type</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/owner/reports/${r.id}`}>{r.title}</Link></td>
                  <td>{(r.teachers as unknown as { name: string } | null)?.name ?? ""}</td>
                  <td>{r.copy_ref ?? ""}</td>
                  <td><StatusChip value={r.classification} /></td>
                  <td><StatusChip value={r.status} /></td>
                  <td className="small">{new Date(r.updated_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && <p className="muted">No reports yet.</p>}
        </div>
      </main>
    </>
  );
}
