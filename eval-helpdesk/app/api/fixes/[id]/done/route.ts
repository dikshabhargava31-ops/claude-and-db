import { apiSession, errorResponse, HttpError, requireClaudeCodeKey } from "../../../../../lib/auth";
import { redact } from "../../../../../lib/redact";
import { db } from "../../../../../lib/supabase";

// Mark an approved fix as done. Works with the Claude Code key (Bearer) or a
// signed-in owner/developer on the Fixes page.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get("authorization")) await requireClaudeCodeKey(req.headers);
    else await apiSession("owner", "developer");
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const { data, error } = await db()
      .from("change_requests")
      .update({ status: "done", done_at: new Date().toISOString(), done_note: body.note ? redact(String(body.note)).slice(0, 4000) : null })
      .eq("id", id)
      .eq("status", "approved") // only approved fixes can be marked done
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "No approved fix with that id");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
