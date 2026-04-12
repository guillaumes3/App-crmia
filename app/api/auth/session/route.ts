import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildIdentitySessionPayload,
  createIdentitySessionToken,
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  IDENTITY_SESSION_MAX_AGE_SECONDS,
} from "@/app/utils/identitySession";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";
import { KIPILOTE_UNIVERSE_COOKIE } from "@/app/utils/universeCookie";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const accessToken = payload.accessToken;
    const sessionSecret = getIdentitySessionSecret();

    if (!accessToken || !sessionSecret) {
      return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
    }

    // On utilise la clé service role pour bypasser les sécurités et lire le profil
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!!,
      { auth: { persistSession: false } }
    );

    // 1. Récupérer l'utilisateur Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: "Session invalide." }, { status: 401 });
    }

    // 2. LA CORRECTION : On cherche SPECIFIQUEMENT sur auth_user_id
    // Car ton 'id' est un chiffre (1) et ton 'user.id' est un UUID (65d3261c...)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, organisation_id, is_hq_staff")
      .eq("auth_user_id", user.id) // <--- C'est cette ligne qui débloque tout
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Profil non trouvé pour l'ID:", user.id);
      return NextResponse.json({ error: "Profil introuvable pour cet utilisateur." }, { status: 403 });
    }

    // 3. Génération de la session
    const expiresAt = Math.floor(Date.now() / 1000) + IDENTITY_SESSION_MAX_AGE_SECONDS;
    const identity = buildIdentitySessionPayload(
      {
        id: user.id,
        email: user.email,
        user_metadata: {
          is_hq_staff: profile.is_hq_staff === true,
          organisation_id: profile.organisation_id,
        },
      },
      expiresAt
    );

    if (!identity) {
      return NextResponse.json({ error: "Erreur de payload." }, { status: 500 });
    }

    const token = createIdentitySessionToken(identity, sessionSecret);
    const response = NextResponse.json({
      universe: identity.universe,
      isHqStaff: identity.isHqStaff,
      organisationId: identity.organisationId,
    });

    // 4. Cookies
    const cookieOptions = {
      httpOnly: true,
      path: "/",
      maxAge: IDENTITY_SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
    };

    response.cookies.set({ name: IDENTITY_SESSION_COOKIE, value: token, ...cookieOptions });
    response.cookies.set({ name: KIPILOTE_UNIVERSE_COOKIE, value: identity.universe, ...cookieOptions });

    return response;
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}