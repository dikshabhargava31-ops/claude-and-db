import { apiSession, errorResponse, HttpError } from "../../../../lib/auth";
import { hashAccessCode, newAccessCode } from "../../../../lib/session";
import { db } from "../../../../lib/supabase";

// Add a teacher. The access code is returned ONCE and only its hash is stored.
export async function POST(req: Request) {
  try {
    await apiSession("owner");
    const { name, school } = (await req.json()) as { name?: string; school?: string };
    if (!name || name.trim().length < 2) throw new HttpError(400, "Enter the teacher's name.");
    const code = newAccessCode();
    const { error } = await db().from("teachers").insert({
      name: name.trim().slice(0, 100),
      school: school?.trim().slice(0, 100) || null,
      access_code_hash: hashAccessCode(code),
    });
    if (error) throw error;
    return Response.json({ code });
  } catch (e) {
    return errorResponse(e);
  }
}
