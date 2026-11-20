import { cookies } from "next/headers";
import { env } from "../../../../lib/env";
import { errorResponse, HttpError } from "../../../../lib/auth";
import { COOKIE, encodeSession, hashAccessCode, OWNER_TTL_S, safeEqual, TEACHER_TTL_S, type Session } from "../../../../lib/session";
import { db } from "../../../../lib/supabase";

// Simple brute-force brake: a failed attempt waits ~1 s before answering.
const slow = () => new Promise((r) => setTimeout(r, 900 + Math.random() * 300));

export async function POST(req: Request) {
  try {
    const { role, secret } = (await req.json()) as { role?: string; secret?: string };
    if (typeof secret !== "string" || secret.length < 4 || secret.length > 200) throw new HttpError(400, "Enter your code or password.");
    const now = Math.floor(Date.now() / 1000);
    let session: Session | null = null;

    if (role === "teacher") {
      const { data } = await db()
        .from("teachers")
        .select("id, name, active")
        .eq("access_code_hash", hashAccessCode(secret))
        .maybeSingle();
      if (data?.active) session = { role: "teacher", tid: data.id, name: data.name, exp: now + TEACHER_TTL_S };
    } else if (role === "owner") {
      if (safeEqual(secret, env.ownerPassword)) session = { role: "owner", exp: now + OWNER_TTL_S };
    } else if (role === "developer") {
      if (env.developerPassword.length >= 12 && safeEqual(secret, env.developerPassword)) {
        session = { role: "developer", exp: now + OWNER_TTL_S };
      }
    }

    if (!session) {
      await slow();
      throw new HttpError(401, role === "teacher" ? "That access code is not valid." : "Wrong password.");
    }

    const store = await cookies();
    store.set(COOKIE, encodeSession(session, env.sessionSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.exp - now,
    });
    const next = session.role === "teacher" ? "/reports" : session.role === "owner" ? "/owner" : "/fixes";
    return Response.json({ next });
  } catch (e) {
    return errorResponse(e);
  }
}
