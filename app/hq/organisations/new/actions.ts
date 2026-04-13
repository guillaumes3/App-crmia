"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentIdentity } from "@/app/security/currentIdentity";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";
import { createOrganisationSchema } from "./schema";

export type CreateOrganisationActionState = {
  message: string;
  fieldErrors: {
    name?: string;
    slug?: string;
    primaryColor?: string;
    logoUrl?: string;
  };
};

export async function createOrganisation(
  _prevState: CreateOrganisationActionState,
  formData: FormData,
): Promise<CreateOrganisationActionState> {
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
      },
    };
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

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

  const { error: insertError } = await supabaseAdmin.from("organisations").insert([
    {
      nom: parsed.data.name,
      slug: parsed.data.slug,
      logo_url: parsed.data.logoUrl || null,
      primary_color: parsed.data.primaryColor || null,
    },
  ]);

  if (insertError) {
    return {
      message: normalizeDatabaseError(insertError.message),
      fieldErrors: {},
    };
  }

  revalidatePath("/hq/master-admin");
  revalidatePath("/hq/organisations");
  redirect("/hq/organisations");
}

function normalizeDatabaseError(raw: string | null | undefined): string {
  const message = (raw ?? "").toLowerCase();

  if (message.includes("slug") && message.includes("already")) {
    return "Ce slug est deja utilise.";
  }

  if (message.includes("column") && message.includes("does not exist")) {
    return "Colonnes marque blanche manquantes en base (slug/logo_url/primary_color).";
  }

  return "Erreur serveur pendant la creation de l organisation.";
}
