"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setupCompanySchema } from "@/app/actions/setup-company.schema";
import { getCurrentIdentity } from "@/app/security/currentIdentity";
import { findHqProfileByIdentity } from "@/app/utils/hqProfileLookup";
import { SUPABASE_URL } from "@/app/utils/supabase";

type FieldErrors = {
  name?: string;
  slug?: string;
  adminEmail?: string;
  temporaryPassword?: string;
  logoUrl?: string;
  primaryColor?: string;
};

export type SetupCompanyActionState = {
  message: string;
  fieldErrors: FieldErrors;
};

export async function setupCompany(
  _prevState: SetupCompanyActionState,
  formData: FormData,
): Promise<SetupCompanyActionState> {
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

  const payload = setupCompanySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    adminEmail: formData.get("adminEmail"),
    temporaryPassword: formData.get("temporaryPassword"),
    logoUrl: formData.get("logoUrl"),
    primaryColor: formData.get("primaryColor"),
  });

  if (!payload.success) {
    const errors = payload.error.flatten().fieldErrors;
    return {
      message: "Merci de corriger les champs invalides.",
      fieldErrors: {
        name: errors.name?.[0],
        slug: errors.slug?.[0],
        adminEmail: errors.adminEmail?.[0],
        temporaryPassword: errors.temporaryPassword?.[0],
        logoUrl: errors.logoUrl?.[0],
        primaryColor: errors.primaryColor?.[0],
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

  const { data: existingSlug, error: existingSlugError } = await supabaseAdmin
    .from("organisations")
    .select("id")
    .eq("slug", payload.data.slug)
    .maybeSingle();

  if (existingSlugError) {
    return {
      message: normalizeSupabaseError(existingSlugError.message),
      fieldErrors: {},
    };
  }

  if (existingSlug) {
    return {
      message: "Ce slug est deja utilise.",
      fieldErrors: {
        slug: "Ce slug est deja pris. Choisissez-en un autre.",
      },
    };
  }

  const { data: organisation, error: organisationError } = await supabaseAdmin
    .from("organisations")
    .insert([
      {
        nom: payload.data.name,
        slug: payload.data.slug,
        logo_url: payload.data.logoUrl || null,
        primary_color: payload.data.primaryColor || null,
      },
    ])
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (organisationError || !organisation) {
    return {
      message: normalizeSupabaseError(organisationError?.message),
      fieldErrors: {},
    };
  }

  const createAdminUser = await supabaseAdmin.auth.admin.createUser({
    email: payload.data.adminEmail,
    password: payload.data.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      organisation_id: organisation.id,
      organisation_slug: organisation.slug,
      role: "Administrateur",
      is_hq_staff: false,
    },
    app_metadata: {
      organisation_id: organisation.id,
      organisation_slug: organisation.slug,
      role: "Administrateur",
      is_hq_staff: false,
    },
  });

  if (createAdminUser.error || !createAdminUser.data.user?.id) {
    const rollback = await rollbackOrganisationOnly(supabaseAdmin, organisation.id);
    return {
      message: createAtomicFailureMessage(
        "Echec creation utilisateur administrateur.",
        createAdminUser.error?.message,
        rollback,
      ),
      fieldErrors: {
        adminEmail: "Impossible de creer l utilisateur avec cet email.",
      },
    };
  }

  const authUserId = createAdminUser.data.user.id;
  const linkProfileResult = await createProfileLink(supabaseAdmin, {
    authUserId,
    organisationId: organisation.id,
    email: payload.data.adminEmail,
  });

  if (!linkProfileResult.ok) {
    const rollback = await rollbackOrganisationAndUser(supabaseAdmin, {
      organisationId: organisation.id,
      authUserId,
    });

    return {
      message: createAtomicFailureMessage(
        "Echec liaison profile/organisation.",
        linkProfileResult.errorMessage,
        rollback,
      ),
      fieldErrors: {},
    };
  }

  revalidatePath("/hq/master-admin");
  revalidatePath("/hq/organisations");
  redirect("/hq/organisations");
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

function isRecoverableInsertError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("column") || normalized.includes("42703") || normalized.includes("22p02");
}

function normalizeSupabaseError(raw: string | null | undefined): string {
  const normalized = (raw ?? "").toLowerCase();

  if (normalized.includes("slug") && normalized.includes("duplicate")) {
    return "Ce slug est deja utilise.";
  }

  if (normalized.includes("slug") && normalized.includes("already")) {
    return "Ce slug est deja utilise.";
  }

  if (normalized.includes("email") && normalized.includes("already")) {
    return "Cet email administrateur est deja utilise.";
  }

  if (normalized.includes("column") && normalized.includes("does not exist")) {
    return "Schema incomplet en base (verifiez slug/logo_url/primary_color ou profiles).";
  }

  return "Une erreur serveur est survenue pendant le provisioning.";
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
