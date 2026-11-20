import { errorResponse, HttpError, requireIntegrationToken } from "../../../../lib/auth";
import { redactDeep } from "../../../../lib/redact";
import { db } from "../../../../lib/supabase";

// Optional: the evaluation app sends the marks data for a checked copy, so the
// assistant can compare answers with the key instead of relying on screenshots.
// POST with "Authorization: Bearer <INTEGRATION_TOKEN>" and JSON:
// { "copy_ref": "...", "subject": "...", "questions": [ { "no": "1", "type": "mcq",
//   "max_marks": 1, "answer_key": "B", "student_answer": "B", "marks_awarded": 0, "ai_comment": "..." } ] }
// Send only marking data. Fields named like secrets are dropped automatically.
export async function POST(req: Request) {
  try {
    requireIntegrationToken(req.headers);
    const text = await req.text();
    if (text.length > 500_000) throw new HttpError(413, "Too large");
    const body = JSON.parse(text) as { copy_ref?: unknown };
    if (typeof body.copy_ref !== "string" || !body.copy_ref.trim()) throw new HttpError(400, "copy_ref is required");
    const { error } = await db()
      .from("copy_snapshots")
      .upsert({ copy_ref: body.copy_ref.trim().slice(0, 100), data: redactDeep(body), received_at: new Date().toISOString() });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    return errorResponse(e);
  }
}
