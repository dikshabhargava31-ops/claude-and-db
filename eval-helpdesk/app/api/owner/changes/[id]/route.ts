import { apiSession, errorResponse, HttpError } from "../../../../../lib/auth";
import type { ChangeRow } from "../../../../../lib/fixes";
import { notifyApproved, openGithubIssue } from "../../../../../lib/notify";
import { redact } from "../../../../../lib/redact";
import { db } from "../../../../../lib/supabase";

// Owner approves or rejects a change-log entry (or reopens it as pending).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await apiSession("owner");
    const { id } = await params;
    const body = (await req.json()) as { status?: string; note?: string; proposed_change?: string };
    if (!["approved", "rejected", "pending"].includes(body.status ?? "")) throw new HttpError(400, "Unknown status");

    const update: Record<string, unknown> = {
      status: body.status,
      owner_note: body.note ? redact(body.note).slice(0, 4000) : null,
      decided_at: body.status === "pending" ? null : new Date().toISOString(),
    };
    if (body.proposed_change) update.proposed_change = redact(body.proposed_change).slice(0, 8000);

    const { data: row, error } = await db().from("change_requests").update(update).eq("id", id).select("*").single();
    if (error || !row) throw new HttpError(404, "Change not found");

    if (body.status === "approved") {
      const change = row as ChangeRow;
      const [issueUrl] = await Promise.all([
        change.github_issue_url ? Promise.resolve(change.github_issue_url) : openGithubIssue(change),
        notifyApproved(change),
      ]);
      if (issueUrl && !change.github_issue_url) {
        await db().from("change_requests").update({ github_issue_url: issueUrl }).eq("id", id);
      }
      return Response.json({ ok: true, github_issue_url: issueUrl });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
