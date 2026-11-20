import { errorResponse, requireClaudeCodeKey } from "../../../lib/auth";
import { env } from "../../../lib/env";
import { bySeverity, fixesToMarkdown, type ChangeRow } from "../../../lib/fixes";
import { db } from "../../../lib/supabase";

// For Claude Code (any account): the approved fixes that are not done yet.
// Needs the helpdesk key as "Authorization: Bearer <key>". The key can read
// nothing else: no teacher reports, no screenshots, no teacher names.
//   GET /api/fixes            -> Markdown instructions
//   GET /api/fixes?format=json -> JSON
export async function GET(req: Request) {
  try {
    await requireClaudeCodeKey(req.headers);
    const { data } = await db()
      .from("change_requests")
      .select("id, title, area, severity, evidence, suspected_cause, proposed_change, status, owner_note, created_at, decided_at")
      .eq("status", "approved");
    const rows = ((data ?? []) as ChangeRow[]).sort(bySeverity);
    if (new URL(req.url).searchParams.get("format") === "json") {
      return Response.json({ fixes: rows.map((r) => ({ ...r, report_id: undefined })) });
    }
    return new Response(fixesToMarkdown(rows, env.appUrl), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  } catch (e) {
    return errorResponse(e);
  }
}
