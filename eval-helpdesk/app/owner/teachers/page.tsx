import { pageSession } from "../../../lib/auth";
import { db } from "../../../lib/supabase";
import { AddTeacher, TeacherRowActions } from "../../../components/client";
import { StatusChip, TopBar } from "../../../components/TopBar";

export default async function Teachers() {
  await pageSession("owner");
  const { data } = await db().from("teachers").select("id, name, school, active, created_at").order("name");
  return (
    <>
      <TopBar role="owner" name="Owner" />
      <main>
        <h1>Teachers</h1>
        <AddTeacher />
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Name</th><th>School</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td><td>{t.school ?? ""}</td>
                  <td><StatusChip value={t.active ? "approved" : "rejected"} /></td>
                  <td><TeacherRowActions id={t.id} name={t.name} active={t.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && <p className="muted">No teachers yet.</p>}
        </div>
      </main>
    </>
  );
}
