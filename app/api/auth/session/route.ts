import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildIdentitySessionPayload,
  createIdentitySessionToken,
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  IDENTITY_SESSION_MAX_AGE_SECONDS,
} from "@/app/utils/identitySession";
import { HQ_SESSION_COOKIE } from "@/app/utils/hqSession";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";
import { KIPILOTE_UNIVERSE_COOKIE } from "@/app/utils/universeCookie";

type SessionPayload = {
  accessToken?: string;
};

type ProfileSessionRow = {
  auth_user_id: string | null;
  organisation_id: string | null;
  is_hq_staff: boolean | null;
};

export async function POST(request: Request) {
  let payload: SessionPayload;
  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  if (!payload.accessToken) {
    return NextResponse.json({ error: "Jeton d acces manquant." }, { status: 400 });
  }

  const sessionSecret = getIdentitySessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ error: "IDENTITY_SESSION_SECRET manquante." }, { status: 500 });
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("auth_user_id, organisation_id, is_hq_staff")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle<ProfileSessionRow>();

  if (profileError) {
    return NextResponse.json({ error: "Impossible de lire votre profil utilisateur." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable pour cet utilisateur." }, { status: 403 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + IDENTITY_SESSION_MAX_AGE_SECONDS;
  const identity = buildIdentitySessionPayload(
    {
      id: userData.user.id,
      email: userData.user.email,
      user_metadata: {
        is_hq_staff: profile.is_hq_staff === true,
        organisation_id: profile.organisation_id,
      },
    },
    expiresAt,
  );

  if (!identity) {
    return NextResponse.json(
      {
        error:
          "Profil utilisateur incomplet. Verifiez que is_hq_staff et organisation_id sont correctement renseignes.",
      },
      { status: 403 },
    );
  }

  const token = createIdentitySessionToken(identity, sessionSecret);
  const response = NextResponse.json({
    universe: identity.universe,
    isHqStaff: identity.isHqStaff,
    organisationId: identity.organisationId ?? null,
  });

  response.cookies.set({
    name: IDENTITY_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDENTITY_SESSION_MAX_AGE_SECONDS,
  });

  response.cookies.set({
    name: KIPILOTE_UNIVERSE_COOKIE,
    value: identity.universe,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDENTITY_SESSION_MAX_AGE_SECONDS,
  });

  if (identity.isHqStaff === false) {
    response.cookies.set({
      name: HQ_SESSION_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}
