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
import { normalizeCompanySlug } from "@/app/utils/companySlug";

type SessionBootstrapPayload = {
  accessToken?: string;
  slug?: string;
};

type SessionProfileRow = {
  id: string;
  organisation_id: string | null;
  is_hq_staff: boolean | null;
  role: string | null;
};

type OrganisationSlugRow = {
  slug: string | null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SessionBootstrapPayload;
    const accessToken = payload.accessToken;
    const requestedSlug = normalizeCompanySlug(payload.slug ?? "");
    const sessionSecret = getIdentitySessionSecret();

    if (!accessToken || !sessionSecret) {
      return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: "Session invalide." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, organisation_id, is_hq_staff, role")
      .eq("auth_user_id", user.id)
      .maybeSingle<SessionProfileRow>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable pour cet utilisateur." }, { status: 403 });
    }

    let organisationSlug: string | null = null;
    if (profile.is_hq_staff !== true) {
      if (!profile.organisation_id) {
        return NextResponse.json({ error: "Profil client incomplet." }, { status: 403 });
      }

      const { data: organisation, error: organisationError } = await supabaseAdmin
        .from("organisations")
        .select("slug")
        .eq("id", profile.organisation_id)
        .maybeSingle<OrganisationSlugRow>();

      if (organisationError || !organisation) {
        return NextResponse.json({ error: "Organisation introuvable pour ce profil." }, { status: 403 });
      }

      organisationSlug = normalizeCompanySlug(organisation.slug ?? "");
      if (!organisationSlug) {
        return NextResponse.json({ error: "Slug entreprise manquant. Contactez le support." }, { status: 403 });
      }

      if (requestedSlug && requestedSlug !== organisationSlug) {
        return NextResponse.json(
          { error: "Acces refuse: ce compte n appartient pas a cette entreprise." },
          { status: 403 },
        );
      }
    }

    const expiresAt = Math.floor(Date.now() / 1000) + IDENTITY_SESSION_MAX_AGE_SECONDS;
    const identity = buildIdentitySessionPayload(
      {
        id: user.id,
        email: user.email,
        user_metadata: {
          is_hq_staff: profile.is_hq_staff === true,
          organisation_id: profile.organisation_id,
          organisation_slug: organisationSlug,
          role: profile.role ?? user.user_metadata?.role,
        },
      },
      expiresAt,
    );

    if (!identity) {
      return NextResponse.json({ error: "Erreur de payload." }, { status: 500 });
    }

    const token = createIdentitySessionToken(identity, sessionSecret);
    const response = NextResponse.json({
      universe: identity.universe,
      isHqStaff: identity.isHqStaff,
      organisationId: identity.universe === "client" ? identity.organisationId : null,
      organisationSlug: identity.universe === "client" ? identity.organisationSlug : null,
      role: identity.universe === "client" ? identity.role : null,
    });

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
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
