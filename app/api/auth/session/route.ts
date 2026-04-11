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

type SessionPayload = {
  accessToken?: string;
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

  const expiresAt = Math.floor(Date.now() / 1000) + IDENTITY_SESSION_MAX_AGE_SECONDS;
  const identity = buildIdentitySessionPayload(
    {
      id: userData.user.id,
      email: userData.user.email,
      user_metadata: userData.user.user_metadata as Record<string, unknown> | undefined,
    },
    expiresAt,
  );

  if (!identity) {
    return NextResponse.json({ error: "Metadonnees utilisateur invalides." }, { status: 403 });
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
