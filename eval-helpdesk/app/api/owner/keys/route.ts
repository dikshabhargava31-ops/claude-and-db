import { randomBytes } from "node:crypto";
import { apiSession, errorResponse, hashKey } from "../../../../lib/auth";
import { db } from "../../../../lib/supabase";

// Make a new Claude Code key. Every older key is revoked, so there is only
// ever one working key. The key is shown once; only its hash is stored.
export async function POST(req: Request) {
  try {
    await apiSession("owner");
    const { label } = (await req.json().catch(() => ({}))) as { label?: string };
    const key = `hdk_${randomBytes(24).toString("base64url")}`;
    await db().from("api_keys").update({ revoked: true }).eq("revoked", false);
    const { error } = await db().from("api_keys").insert({
      label: (label || "Claude Code").slice(0, 60),
      key_hash: hashKey(key),
    });
    if (error) throw error;
    return Response.json({ key });
  } catch (e) {
    return errorResponse(e);
  }
}

// Revoke every key (for example if one was shared by mistake).
export async function DELETE() {
  try {
    await apiSession("owner");
    await db().from("api_keys").update({ revoked: true }).eq("revoked", false);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
