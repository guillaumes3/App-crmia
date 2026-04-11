import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getHqSessionSecret,
  HQ_SESSION_COOKIE,
  normalizeHqRole,
  verifyHqSessionToken,
} from "@/app/utils/hqSession";
import { findHqProfileByIdentity } from "@/app/utils/hqProfileLookup";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";

export async function GET(request: Request) {
  const sessionSecret = getHqSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Configuration HQ incomplete sur le serveur." }, { status: 500 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenPair = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${HQ_SESSION_COOKIE}=`));
  const token = tokenPair?.split("=")[1] ?? "";

  const decoded = token ? verifyHqSessionToken(token, sessionSecret) : null;
  if (!decoded) {
    return NextResponse.json({ error: "Session HQ invalide." }, { status: 401 });
  }

  const supabase = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const profile = await findHqProfileByIdentity(supabase, {
    userId: decoded.sub,
    email: decoded.email,
  });

  const role = normalizeHqRole(profile?.role_hq);
  if (!profile || !profile.is_hq_staff || !role) {
    const forbiddenResponse = NextResponse.json({ error: "Acces HQ retire." }, { status: 403 });
    forbiddenResponse.cookies.set({
      name: HQ_SESSION_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return forbiddenResponse;
  }

  return NextResponse.json({
    userId: decoded.sub,
    role,
    name: [profile.prenom, profile.nom].filter(Boolean).join(" ").trim() || "Membre staff",
  });
}
