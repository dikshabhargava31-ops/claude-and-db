import { apiSession, errorResponse, HttpError } from "../../../../../lib/auth";
import { hashAccessCode, newAccessCode } from "../../../../../lib/session";
import { db } from "../../../../../lib/supabase";

// Switch a teacher on/off, or give them a new code (the old one stops working).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await apiSession("owner");
    const { id } = await params;
    const body = (await req.json()) as { active?: boolean; newCode?: boolean };
    if (body.newCode) {
      const code = newAccessCode();
      const { error } = await db().from("teachers").update({ access_code_hash: hashAccessCode(code) }).eq("id", id);
      if (error) throw error;
      return Response.json({ code });
    }
    if (typeof body.active !== "boolean") throw new HttpError(400, "Nothing to change");
    const { error } = await db().from("teachers").update({ active: body.active }).eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
