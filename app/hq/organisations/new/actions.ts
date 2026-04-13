"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentIdentity } from "@/app/security/currentIdentity";
import { SUPABASE_URL } from "@/app/utils/supabase";
import { createOrganisationSchema } from "./schema";

export type CreateOrganisationActionState = {
  message: string;
  fieldErrors: {
    name?: string;
    slug?: string;
    primaryColor?: string;
    logoUrl?: string;
    adminEmail?: string;
    temporaryPassword?: string;
  };
};

export async function createOrganisation(
  _prevState: CreateOrganisationActionState,
  formData: FormData,
): Promise<CreateOrganisationActionState> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      message: "Configuration serveur incomplete: SUPABASE_SERVICE_ROLE_KEY manquante.",
      fieldErrors: {},
    };
  }

  const identity = await getCurrentIdentity();
  if (!identity || identity.universe !== "hq" || identity.isHqStaff !== true) {
    return {
      message: "Acces refuse. Session HQ requise.",
      fieldErrors: {},
    };
  }

  const parsed = createOrganisationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    primaryColor: formData.get("primaryColor"),
    logoUrl: formData.get("logoUrl"),
    adminEmail: formData.get("adminEmail"),
    temporaryPassword: formData.get("temporaryPassword"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      message: "Merci de corriger les champs invalides.",
      fieldErrors: {
        name: errors.name?.[0],
        slug: errors.slug?.[0],
        primaryColor: errors.primaryColor?.[0],
        logoUrl: errors.logoUrl?.[0],
        adminEmail: errors.adminEmail?.[0],
        temporaryPassword: errors.temporaryPassword?.[0],
      },
    };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("organisations")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existingError) {
    return {
      message: normalizeDatabaseError(existingError.message),
      fieldErrors: {},
    };
  }

  if (existing) {
    return {
      message: "Ce slug est deja utilise.",
      fieldErrors: {
        slug: "Ce slug est deja pris. Choisissez-en un autre.",
      },
    };
  }

  const { data: organisation, error: insertError } = await supabaseAdmin
    .from("organisations")
    .insert([
      {
        nom: parsed.data.name,
        slug: parsed.data.slug,
        logo_url: parsed.data.logoUrl || null,
        primary_color: parsed.data.primaryColor || null,
      },
    ])
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (insertError || !organisation) {
    return {
      message: normalizeDatabaseError(insertError?.message),
      fieldErrors: {},
    };
  }

  const authCreation = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.adminEmail,
    password: parsed.data.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      role: "Administrateur",
      organisation_id: organisation.id,
      organisation_slug: organisation.slug,
      is_hq_staff: false,
    },
    app_metadata: {
      role: "Administrateur",
      organisation_id: organisation.id,
      organisation_slug: organisation.slug,
      is_hq_staff: false,
    },
  });

  if (authCreation.error || !authCreation.data.user?.id) {
    const rollback = await rollbackOrganisationOnly(supabaseAdmin, organisation.id);
    return {
      message: createAtomicFailureMessage(
        "Echec creation utilisateur administrateur.",
        normalizeAuthError(authCreation.error?.message),
        rollback,
      ),
      fieldErrors: {
        adminEmail: isEmailAlreadyTakenError(authCreation.error?.message)
          ? "Cet email administrateur est deja utilise."
          : undefined,
      },
    };
  }

  const profileCreation = await createProfileLink(supabaseAdmin, {
    authUserId: authCreation.data.user.id,
    organisationId: organisation.id,
    email: parsed.data.adminEmail,
  });

  if (!profileCreation.ok) {
    const rollback = await rollbackOrganisationAndUser(supabaseAdmin, {
      organisationId: organisation.id,
      authUserId: authCreation.data.user.id,
    });

    return {
      message: createAtomicFailureMessage("Echec creation profile administrateur.", profileCreation.errorMessage, rollback),
      fieldErrors: {},
    };
  }

  const loginUrl = buildClientLoginUrl(organisation.slug);
  const successMessage = `Organisation creee avec succes. URL de connexion: ${loginUrl}`;
  const query = new URLSearchParams({
    success: successMessage,
    loginUrl,
    slug: organisation.slug,
  });

  revalidatePath("/hq/master-admin");
  revalidatePath("/hq/organisations");
  redirect(`/hq/organisations?${query.toString()}`);
}

type RollbackResult = {
  organisationDeleted: boolean;
  userDeleted: boolean;
};

type RollbackInput = {
  organisationId: string;
  authUserId: string;
};

async function rollbackOrganisationOnly(
  supabaseAdmin: SupabaseClient,
  organisationId: string,
): Promise<RollbackResult> {
  const { error } = await supabaseAdmin.from("organisations").delete().eq("id", organisationId);

  return {
    organisationDeleted: !error,
    userDeleted: false,
  };
}

async function rollbackOrganisationAndUser(
  supabaseAdmin: SupabaseClient,
  input: RollbackInput,
): Promise<RollbackResult> {
  const deleteUser = await supabaseAdmin.auth.admin.deleteUser(input.authUserId);
  const deleteOrganisation = await supabaseAdmin.from("organisations").delete().eq("id", input.organisationId);

  return {
    organisationDeleted: !deleteOrganisation.error,
    userDeleted: !deleteUser.error,
  };
}

type CreateProfileLinkInput = {
  authUserId: string;
  organisationId: string;
  email: string;
};

type CreateProfileLinkResult =
  | { ok: true }
  | {
      ok: false;
      errorMessage: string;
    };

async function createProfileLink(
  supabaseAdmin: SupabaseClient,
  input: CreateProfileLinkInput,
): Promise<CreateProfileLinkResult> {
  const base = {
    organisation_id: input.organisationId,
    role: "Administrateur",
    is_hq_staff: false,
    role_hq: null,
    email: input.email,
  };

  const insertAttempts: Array<Record<string, unknown>> = [
    { ...base, auth_user_id: input.authUserId },
    { ...base, user_id: input.authUserId },
    { ...base, id: input.authUserId },
  ];

  let lastError = "Insertion profile impossible.";

  for (const attempt of insertAttempts) {
    const { error } = await supabaseAdmin.from("profiles").insert(attempt);

    if (!error) {
      return { ok: true };
    }

    if (!isRecoverableInsertError(error.message)) {
      return {
        ok: false,
        errorMessage: error.message,
      };
    }

    lastError = error.message;
  }

  return {
    ok: false,
    errorMessage: lastError,
  };
}

function normalizeDatabaseError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim().toLowerCase();

  if (message.includes("slug") && (message.includes("already") || message.includes("duplicate"))) {
    return "Ce slug est deja utilise.";
  }

  if (message.includes("column") && message.includes("does not exist")) {
    return "Schema incomplet en base (verifiez slug/logo_url/primary_color ou profiles).";
  }

  return "Une erreur serveur est survenue pendant le provisioning.";
}

function normalizeAuthError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim().toLowerCase();

  if (isEmailAlreadyTakenError(message)) {
    return "Cet email administrateur est deja utilise.";
  }

  if (message.includes("password") && (message.includes("weak") || message.includes("at least"))) {
    return "Le mot de passe temporaire ne respecte pas la politique de securite.";
  }

  return raw?.trim() || "Creation utilisateur impossible.";
}

function isRecoverableInsertError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("column") || normalized.includes("42703") || normalized.includes("22p02");
}

function isEmailAlreadyTakenError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("email") && (normalized.includes("already") || normalized.includes("registered"));
}

function createAtomicFailureMessage(base: string, detail: string | undefined, rollback: RollbackResult): string {
  const rollbackSummary = rollback.organisationDeleted
    ? rollback.userDeleted
      ? "Rollback complet effectue."
      : "Organisation rollbackee."
    : "Rollback partiel requis manuellement.";

  const details = detail ? ` Detail: ${detail}.` : "";
  return `${base}${details} ${rollbackSummary}`;
}

function buildClientLoginUrl(slug: string): string {
  const configuredBaseDomain = process.env.CLIENT_LOGIN_BASE_DOMAIN ?? "mon-saas.com";
  const normalizedBaseDomain = configuredBaseDomain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^\.*/, "")
    .replace(/\/+$/, "");

  return `https://${slug}.${normalizedBaseDomain}/login`;
}
