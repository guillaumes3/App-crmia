const COMPANY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_COMPANY_SLUGS = new Set([
  "api",
  "app",
  "backoffice",
  "companies",
  "dashboard",
  "hq",
  "login",
  "www",
]);

export function slugifyCompanyName(value: string): string {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeCompanySlug(value: string): string {
  return slugifyCompanyName(value).slice(0, 63);
}

export function isReservedCompanySlug(slug: string): boolean {
  return RESERVED_COMPANY_SLUGS.has(slug);
}

export function isValidCompanySlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < 2 || slug.length > 63) return false;
  if (isReservedCompanySlug(slug)) return false;
  return COMPANY_SLUG_REGEX.test(slug);
}
