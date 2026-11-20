import { apiSession, errorResponse } from "../../../../lib/auth";
import { env } from "../../../../lib/env";
import { bySeverity, fixesToMarkdown, type ChangeRow } from "../../../../lib/fixes";
import { db } from "../../../../lib/supabase";

// Download every approved, not-yet-done fix as one Markdown file for Claude Code.
export async function GET() {
  try {
    await apiSession("owner", "developer");
    const { data } = await db().from("change_requests").select("*").eq("status", "approved");
    const md = fixesToMarkdown(((data ?? []) as ChangeRow[]).sort(bySeverity), env.appUrl);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="approved-fixes-${new Date().toISOString().slice(0, 10)}.md"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
