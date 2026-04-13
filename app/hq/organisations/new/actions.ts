"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getCurrentIdentity } from "@/app/security/currentIdentity";
import { findHqProfileByIdentity } from "@/app/utils/hqProfileLookup";
import { SUPABASE_URL } from "@/app/utils/supabase";
import { createOrganisationSchema } from "./schema";

type FieldErrors = {
  name?: string;
  slug?: string;
  primaryColor?: string;
  adminEmail?: string;
  adminPassword?: string;
  temporaryPassword?: string;
  logoUrl?: string;
};

export type CreateOrganisationActionState = {
  message: string;
  fieldErrors: FieldErrors;
  success?: boolean;
};

type ProvisioningFailure = {
  baseMessage: string;
  detail?: string;
  fieldErrors: FieldErrors;
};

export async function createEnterpriseAccess(
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

  const adminPasswordRaw = asString(formData.get("adminPassword") ?? formData.get("temporaryPassword"));
  const temporaryPasswordCompat = adminPasswordRaw.length > 0 ? adminPasswordRaw.padEnd(8, "0") : "";
  const parsed = createOrganisationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    primaryColor: formData.get("primaryColor"),
    adminPassword: adminPasswordRaw,
    logoUrl: formData.get("logoUrl"),
    adminEmail: formData.get("adminEmail"),
    temporaryPassword: temporaryPasswordCompat,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const passwordError = errors.adminPassword?.[0] ?? errors.temporaryPassword?.[0];
    return {
      message: "Merci de corriger les champs invalides.",
      fieldErrors: {
        name: errors.name?.[0],
        slug: errors.slug?.[0],
        primaryColor: errors.primaryColor?.[0],
        logoUrl: errors.logoUrl?.[0],
        adminEmail: errors.adminEmail?.[0],
        adminPassword: passwordError,
        temporaryPassword: passwordError,
      },
    };
  }

  if (adminPasswordRaw.length < 6) {
    return {
      message: "Merci de corriger les champs invalides.",
      fieldErrors: {
        adminPassword: "Le mot de passe temporaire doit contenir au moins 6 caracteres.",
        temporaryPassword: "Le mot de passe temporaire doit contenir au moins 6 caracteres.",
      },
    };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const requesterProfile = await findHqProfileByIdentity(supabaseAdmin, {
    userId: identity.sub,
    email: identity.email ?? null,
  });

  if (!requesterProfile || requesterProfile.is_hq_staff !== true || !isSuperAdminRole(requesterProfile.role_hq)) {
    return {
      message: "Acces refuse. Le role Super-Admin HQ est requis.",
      fieldErrors: {},
    };
  }

  const input = parsed.data as {
    name: string;
    slug: string;
    primaryColor?: string;
    adminEmail: string;
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("organisations")
    .select("id")
    .eq("slug", input.slug)
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

  let createdOrganisationId: string | null = null;
  let createdAuthUserId: string | null = null;

  try {
    const { data: organisation, error: insertError } = await supabaseAdmin
      .from("organisations")
      .insert([
        {
          nom: input.name,
          slug: input.slug,
          primary_color: input.primaryColor && input.primaryColor.trim() ? input.primaryColor : null,
        },
      ])
      .select("id, slug")
      .single<{ id: string; slug: string }>();

    if (insertError || !organisation) {
      throw createProvisioningFailure("Echec creation organisation.", normalizeDatabaseError(insertError?.message));
    }

    createdOrganisationId = organisation.id;

    const authCreation = await supabaseAdmin.auth.admin.createUser({
      email: input.adminEmail,
      password: adminPasswordRaw,
      email_confirm: true,
      user_metadata: {
        role: "Administrateur",
        organisation_id: organisation.id,
        organisation_slug: organisation.slug,
      },
      app_metadata: {
        role: "Administrateur",
        organisation_id: organisation.id,
        organisation_slug: organisation.slug,
      },
    });

    if (authCreation.error || !authCreation.data.user?.id) {
      throw createProvisioningFailure(
        "Echec creation utilisateur administrateur.",
        normalizeAuthError(authCreation.error?.message),
        {
          adminEmail: isEmailAlreadyTakenError(authCreation.error?.message)
            ? "Cet email administrateur est deja utilise."
            : undefined,
        },
      );
    }

    createdAuthUserId = authCreation.data.user.id;

    const profileCreation = await createProfileLink(supabaseAdmin, {
      authUserId: createdAuthUserId,
      organisationId: organisation.id,
      email: input.adminEmail,
    });

    if (!profileCreation.ok) {
      throw createProvisioningFailure("Echec creation profile administrateur.", profileCreation.errorMessage);
    }
  } catch (error) {
    const failure = readProvisioningFailure(error);
    const rollback = await rollbackProvisioning(supabaseAdmin, {
      organisationId: createdOrganisationId,
      authUserId: createdAuthUserId,
    });
    return {
      message: createAtomicFailureMessage(failure.baseMessage, failure.detail, rollback),
      fieldErrors: failure.fieldErrors,
    };
  }

  revalidatePath("/hq/organisations");
  return {
    success: true,
    message: "Acces entreprise cree avec succes (organisation + administrateur).",
    fieldErrors: {},
  };
}

type RollbackResult = {
  organisationDeleted: boolean;
  userDeleted: boolean;
};

type RollbackInput = {
  organisationId: string | null;
  authUserId: string | null;
};

async function rollbackProvisioning(
  supabaseAdmin: SupabaseClient,
  input: RollbackInput,
): Promise<RollbackResult> {
  let userDeleted = false;
  if (input.authUserId) {
    const deleteUser = await supabaseAdmin.auth.admin.deleteUser(input.authUserId);
    userDeleted = !deleteUser.error;
  }

  let organisationDeleted = false;
  if (input.organisationId) {
    // Rollback mandatory: remove organisation created at step 1.
    const deleteOrganisation = await supabaseAdmin.from("organisations").delete().eq("id", input.organisationId);
    organisationDeleted = !deleteOrganisation.error;
  }

  return {
    organisationDeleted,
    userDeleted,
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

function createProvisioningFailure(
  baseMessage: string,
  detail?: string,
  fieldErrors: FieldErrors = {},
): ProvisioningFailure {
  return {
    baseMessage,
    detail,
    fieldErrors,
  };
}

function readProvisioningFailure(error: unknown): ProvisioningFailure {
  if (
    typeof error === "object" &&
    error !== null &&
    "baseMessage" in error &&
    typeof (error as { baseMessage: unknown }).baseMessage === "string"
  ) {
    const candidate = error as Partial<ProvisioningFailure>;
    return {
      baseMessage: candidate.baseMessage ?? "Provisioning interrompu.",
      detail: candidate.detail,
      fieldErrors: candidate.fieldErrors ?? {},
    };
  }

  return {
    baseMessage: "Provisioning interrompu.",
    detail: getErrorMessage(error),
    fieldErrors: {},
  };
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

function isSuperAdminRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  return normalized === "super-admin";
}

function asString(value: FormDataEntryValue | null): string {
  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Erreur inconnue";
}

export const createOrganisation = createEnterpriseAccess;
