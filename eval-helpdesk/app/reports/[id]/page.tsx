import { notFound } from "next/navigation";
import { pageSession } from "../../../lib/auth";
import { db } from "../../../lib/supabase";
import { ReplyBox } from "../../../components/client";
import { Thread, type ThreadMessage } from "../../../components/Thread";
import { StatusChip, TopBar } from "../../../components/TopBar";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageSession("teacher");
  const { id } = await params;
  const { data: report } = await db().from("reports").select("*").eq("id", id).eq("teacher_id", s.tid).maybeSingle();
  if (!report) notFound();
  const { data: msgs } = await db().from("report_messages").select("*").eq("report_id", id).order("created_at");
  return (
    <>
      <TopBar role="teacher" name={s.name} />
      <main>
        <div className="row"><h1 className="grow">{report.title}</h1><StatusChip value={report.status} /></div>
        <div className="muted small">{[report.copy_ref && `Copy ${report.copy_ref}`, report.student_ref && `Roll ${report.student_ref}`, report.subject].filter(Boolean).join(" · ")}</div>
        {report.status === "waiting_owner" && <div className="notice">This looks like a bug in the portal. It has been sent to the owner to fix. Please correct the marks by hand for now.</div>}
        <Thread messages={(msgs ?? []) as ThreadMessage[]} teacherName={s.name} />
        {report.status !== "closed" && <ReplyBox reportId={id} />}
      </main>
    </>
  );
}
