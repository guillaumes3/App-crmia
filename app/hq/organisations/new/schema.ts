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
    .refine((value) => COLOR_REGEX.test(value), {
      message: "Couleur invalide. Utilisez un code hex (#RRGGBB).",
    }),
  adminEmail: z.email("Email administrateur invalide.").transform((value) => value.trim().toLowerCase()),
  adminPassword: z
    .string()
    .min(6, "Le mot de passe temporaire doit contenir au moins 6 caracteres."),
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
