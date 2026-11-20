import { notFound } from "next/navigation";
import { pageSession } from "../../../../lib/auth";
import { db } from "../../../../lib/supabase";
import { Thread, type ThreadMessage } from "../../../../components/Thread";
import { StatusChip, TopBar } from "../../../../components/TopBar";

export default async function OwnerReport({ params }: { params: Promise<{ id: string }> }) {
  await pageSession("owner");
  const { id } = await params;
  const { data: report } = await db().from("reports").select("*, teachers(name, school)").eq("id", id).maybeSingle();
  if (!report) notFound();
  const { data: msgs } = await db().from("report_messages").select("*").eq("report_id", id).order("created_at");
  const teacher = report.teachers as { name: string; school: string | null } | null;
  return (
    <>
      <TopBar role="owner" name="Owner" />
      <main>
        <div className="row"><h1 className="grow">{report.title}</h1><StatusChip value={report.classification} /><StatusChip value={report.status} /></div>
        <div className="muted small">
          {[teacher?.name, teacher?.school, report.copy_ref && `Copy ${report.copy_ref}`, report.student_ref && `Roll ${report.student_ref}`, report.subject].filter(Boolean).join(" · ")}
        </div>
        <Thread messages={(msgs ?? []) as ThreadMessage[]} teacherName={teacher?.name ?? "Teacher"} />
      </main>
    </>
  );
}
