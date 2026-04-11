import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildIdentitySessionPayload,
  createIdentitySessionToken,
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  IDENTITY_SESSION_MAX_AGE_SECONDS,
} from "@/app/utils/identitySession";
import {
  createHqSessionToken,
  getHqRedirectByRole,
  getHqSessionSecret,
  HQ_SESSION_COOKIE,
  HQ_SESSION_MAX_AGE_SECONDS,
  normalizeHqRole,
  type HqRole,
} from "@/app/utils/hqSession";
import { findHqProfileByIdentity } from "@/app/utils/hqProfileLookup";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";

type LoginPayload = {
  accessToken?: string;
};

export async function POST(request: Request) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  if (!payload.accessToken) {
    return NextResponse.json({ error: "Jeton d acces manquant." }, { status: 400 });
  }

  const sessionSecret = getHqSessionSecret();
  const identitySecret = getIdentitySessionSecret();
  if (!sessionSecret || !identitySecret) {
    return NextResponse.json(
      { error: "Variables de session HQ manquantes sur le serveur." },
      { status: 500 },
    );
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

  const { data: userData, error: userError } = await supabase.auth.getUser(payload.accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Session Supabase invalide." }, { status: 401 });
  }

  const profile = await findHqProfileByIdentity(supabase, {
    userId: userData.user.id,
    email: userData.user.email,
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil HQ introuvable." }, { status: 403 });
  }

  const isHqStaffMetadata = userData.user.user_metadata?.is_hq_staff === true;
  const role = normalizeHqRole(profile.role_hq);
  if (!profile.is_hq_staff || !isHqStaffMetadata || !role) {
    return NextResponse.json({ error: "Acces staff HQ refuse." }, { status: 403 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + HQ_SESSION_MAX_AGE_SECONDS;
  const identity = buildIdentitySessionPayload(
    {
      id: userData.user.id,
      email: userData.user.email,
      user_metadata: userData.user.user_metadata as Record<string, unknown> | undefined,
    },
    Math.floor(Date.now() / 1000) + IDENTITY_SESSION_MAX_AGE_SECONDS,
  );

  if (!identity || identity.isHqStaff !== true || identity.universe !== "hq") {
    return NextResponse.json({ error: "Metadonnees HQ invalides." }, { status: 403 });
  }

  const token = createHqSessionToken(
    {
      sub: userData.user.id,
      email: userData.user.email,
      role: role as HqRole,
      isHqStaff: true,
      exp: expiresAt,
    },
    sessionSecret,
  );

  const response = NextResponse.json({
    redirectTo: getHqRedirectByRole(role),
    role,
  });

  response.cookies.set({
    name: HQ_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HQ_SESSION_MAX_AGE_SECONDS,
  });

  response.cookies.set({
    name: IDENTITY_SESSION_COOKIE,
    value: createIdentitySessionToken(identity, identitySecret),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDENTITY_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
