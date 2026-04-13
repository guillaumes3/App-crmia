import { z } from "zod";
import { isValidCompanySlug, normalizeCompanySlug } from "@/app/utils/companySlug";

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const setupCompanySchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caracteres.").max(120, "Le nom est trop long."),
  slug: z
    .string()
    .trim()
    .transform((value) => normalizeCompanySlug(value))
    .refine((value) => isValidCompanySlug(value), {
      message: "Slug invalide. Utilisez 2 a 63 caracteres (a-z, 0-9 et tirets).",
    }),
  adminEmail: z.email("Email administrateur invalide.").transform((value) => value.trim().toLowerCase()),
  temporaryPassword: z.string().min(8, "Le mot de passe temporaire doit contenir au moins 8 caracteres."),
  logoUrl: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isHttpUrl(value), {
      message: "URL logo invalide. Utilisez une URL http(s).",
    }),
  primaryColor: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine((value) => value.length === 0 || HEX_COLOR_REGEX.test(value), {
      message: "Couleur invalide. Utilisez un code hex (#RRGGBB).",
    }),
});

export type SetupCompanyInput = z.infer<typeof setupCompanySchema>;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
