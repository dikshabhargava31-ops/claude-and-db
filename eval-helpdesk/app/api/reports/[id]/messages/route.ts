import { apiSession, errorResponse, HttpError } from "../../../../../lib/auth";
import { assertWithinLimit, runAssistant } from "../../../../../lib/assistant";
import { AssistantError } from "../../../../../lib/claude";
import { redact } from "../../../../../lib/redact";
import { db } from "../../../../../lib/supabase";
import { saveScreenshots, UploadError } from "../../../../../lib/uploads";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await apiSession("teacher");
    const { id } = await params;
    // Teachers can only post to their own reports.
    const { data: report } = await db().from("reports").select("id, status").eq("id", id).eq("teacher_id", s.tid).maybeSingle();
    if (!report) throw new HttpError(404, "Report not found");
    if (report.status === "closed") throw new HttpError(400, "This report is closed. Please start a new one.");
    await assertWithinLimit(s.tid);

    const form = await req.formData();
    const message = redact(String(form.get("message") ?? "").trim()).slice(0, 6000);
    const files = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
    if (message.length < 1 && files.length === 0) throw new HttpError(400, "Type a message or attach a screenshot.");

    const attachments = await saveScreenshots(id, files);
    await db().from("report_messages").insert({
      report_id: id,
      role: "teacher",
      content: message || "(screenshot attached)",
      attachments,
    });
    const reply = await runAssistant(id);
    return Response.json({ reply });
  } catch (e) {
    if (e instanceof UploadError || e instanceof AssistantError) return Response.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
