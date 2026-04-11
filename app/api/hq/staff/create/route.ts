import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getHqSessionSecret,
  HQ_SESSION_COOKIE,
  normalizeHqRole,
  verifyHqSessionToken,
} from "@/app/utils/hqSession";
import { findHqProfileByIdentity } from "@/app/utils/hqProfileLookup";
import { SUPABASE_URL } from "@/app/utils/supabase";

type CreateStaffPayload = {
  email?: string;
  prenom?: string;
  nom?: string;
  roleHq?: string;
  matriculeInterne?: string;
};

type SupportedStaffRole = "Admin HQ" | "Support" | "Account_Manager";

const TEMP_PASSWORD = "Kipilote2026!";
const SUPPORTED_ROLES: SupportedStaffRole[] = ["Admin HQ", "Support", "Account_Manager"];

export async function POST(request: Request) {
  let payload: CreateStaffPayload;

  try {
    payload = (await request.json()) as CreateStaffPayload;
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante." }, { status: 500 });
  }

  const sessionSecret = getHqSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ error: "HQ_SESSION_SECRET manquante." }, { status: 500 });
  }

  const email = normalizeEmail(payload.email);
  const prenom = normalizeText(payload.prenom);
  const nom = normalizeText(payload.nom);
  const matriculeInterne = normalizeText(payload.matriculeInterne);
  const roleHq = normalizeRole(payload.roleHq);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  if (!prenom || !nom || !matriculeInterne || !roleHq) {
    return NextResponse.json(
      { error: "Les champs email, prenom, nom, fonction et matricule sont obligatoires." },
      { status: 400 },
    );
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

  const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const requesterProfile = await findHqProfileByIdentity(supabaseAdmin, {
    userId: decoded.sub,
    email: decoded.email,
  });
  const requesterRole = normalizeHqRole(requesterProfile?.role_hq);
  const canManageHqStaff = requesterRole === "Admin" || requesterRole === "Admin HQ";

  if (!requesterProfile || !requesterProfile.is_hq_staff || !canManageHqStaff) {
    return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
  }

  const { data: createdAuthData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      prenom,
      nom,
      is_hq_staff: true,
      role_hq: roleHq,
      matricule_interne: matriculeInterne,
      must_reset_password: true,
    },
    app_metadata: {
      is_hq_staff: true,
      role_hq: roleHq,
      must_reset_password: true,
    },
  });

  if (createAuthError || !createdAuthData.user?.id) {
    return NextResponse.json({ error: createAuthError?.message ?? "Creation Auth impossible." }, { status: 400 });
  }

  const authUserId = createdAuthData.user.id;
  const profileInsert = await createProfileWithFallback(supabaseAdmin, {
    authUserId,
    email,
    prenom,
    nom,
    roleHq,
    matriculeInterne,
  });

  if (!profileInsert.ok) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => null);
    return NextResponse.json(
      { error: profileInsert.errorMessage ?? "Creation du profil impossible." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Collaborateur HQ cree avec succes.",
    temporaryPassword: TEMP_PASSWORD,
    staff: profileInsert.staff,
  });
}

type CreateProfileInput = {
  authUserId: string;
  email: string;
  prenom: string;
  nom: string;
  roleHq: SupportedStaffRole;
  matriculeInterne: string;
};

type ProfileInsertOutcome =
  | { ok: true; staff: Record<string, unknown> }
  | { ok: false; errorMessage: string };

async function createProfileWithFallback(
  supabaseAdmin: SupabaseClient,
  input: CreateProfileInput,
): Promise<ProfileInsertOutcome> {
  const sharedPayload = {
    email: input.email,
    prenom: input.prenom,
    nom: input.nom,
    role_hq: input.roleHq,
    is_hq_staff: true,
  };

  const insertAttempts: Array<Record<string, unknown>> = [
    { ...sharedPayload, user_id: input.authUserId, matricule_interne: input.matriculeInterne },
    { ...sharedPayload, auth_user_id: input.authUserId, matricule_interne: input.matriculeInterne },
    { ...sharedPayload, user_id: input.authUserId, matricule: input.matriculeInterne },
    { ...sharedPayload, auth_user_id: input.authUserId, matricule: input.matriculeInterne },
  ];

  let lastErrorMessage =
    "Impossible d inserer dans profiles. Verifiez les colonnes user_id/auth_user_id et matricule_interne/matricule.";

  for (const attempt of insertAttempts) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert(attempt)
      .select("id, email, prenom, nom, role_hq, is_hq_staff, matricule_interne, matricule")
      .single();

    if (!error && data) {
      return { ok: true, staff: data as Record<string, unknown> };
    }

    if (error && !isRecoverableInsertError(error.message)) {
      return { ok: false, errorMessage: error.message };
    }

    if (error?.message) {
      lastErrorMessage = error.message;
    }
  }

  return { ok: false, errorMessage: lastErrorMessage };
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeRole(value: string | undefined): SupportedStaffRole | null {
  if (!value) return null;
  if (SUPPORTED_ROLES.includes(value as SupportedStaffRole)) {
    return value as SupportedStaffRole;
  }
  return null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRecoverableInsertError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("column") || normalized.includes("42703");
}
