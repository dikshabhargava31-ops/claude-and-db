import { apiSession, errorResponse, HttpError } from "../../../lib/auth";
import { assertWithinLimit, runAssistant } from "../../../lib/assistant";
import { AssistantError } from "../../../lib/claude";
import { redact } from "../../../lib/redact";
import { db } from "../../../lib/supabase";
import { saveScreenshots, UploadError } from "../../../lib/uploads";

export const maxDuration = 300; // Claude may take a while on several screenshots

const field = (f: FormData, k: string, max: number) => redact(String(f.get(k) ?? "").trim()).slice(0, max);

export async function POST(req: Request) {
  try {
    const s = await apiSession("teacher");
    await assertWithinLimit(s.tid);
    const form = await req.formData();
    const message = field(form, "message", 6000);
    if (message.length < 5) throw new HttpError(400, "Please describe the problem.");
    const title = field(form, "title", 160) || message.slice(0, 80);

    const { data: report, error } = await db()
      .from("reports")
      .insert({
        teacher_id: s.tid,
        title,
        copy_ref: field(form, "copy_ref", 100) || null,
        student_ref: field(form, "student_ref", 100) || null,
        subject: field(form, "subject", 100) || null,
      })
      .select("id")
      .single();
    if (error || !report) throw error ?? new Error("Could not save the report");

    const files = form.getAll("screenshots").filter((f): f is File => f instanceof File);
    const attachments = await saveScreenshots(report.id, files);
    await db().from("report_messages").insert({ report_id: report.id, role: "teacher", content: message, attachments });

    try {
      await runAssistant(report.id);
    } catch (e) {
      if (!(e instanceof AssistantError)) throw e;
      return Response.json({ id: report.id, warning: e.message });
    }
    return Response.json({ id: report.id });
  } catch (e) {
    if (e instanceof UploadError || e instanceof AssistantError) return Response.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
