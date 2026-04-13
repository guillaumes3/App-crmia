import { z } from "zod";
import { isValidCompanySlug, normalizeCompanySlug } from "@/app/utils/companySlug";

const COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const createOrganisationSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caracteres.").max(120, "Le nom est trop long."),
  slug: z
    .string()
    .trim()
    .transform((value) => normalizeCompanySlug(value))
    .refine((value) => isValidCompanySlug(value), {
      message: "Slug invalide. Utilisez 2 a 63 caracteres (a-z, 0-9 et tirets).",
    }),
  primaryColor: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine((value) => value.length === 0 || COLOR_REGEX.test(value), {
      message: "Couleur invalide. Utilisez un code hex (#RRGGBB).",
    }),
  logoUrl: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isHttpUrl(value), {
      message: "URL logo invalide. Utilisez une URL http(s).",
    }),
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
