import { createClient } from "@supabase/supabase-js";
import TenantLoginClient from "./TenantLoginClient";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/app/utils/supabase";
import { normalizeCompanySlug } from "@/app/utils/companySlug";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CompanyBrandingRow = {
  nom: string | null;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

const DEFAULT_PRIMARY_COLOR = "#0ea5e9";

export default async function CompanyLoginPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeCompanySlug(slug);
  const branding = normalizedSlug ? await fetchBranding(normalizedSlug) : null;

  return (
    <TenantLoginClient
      tenantSlug={normalizedSlug || slug.toLowerCase()}
      companyName={branding?.nom ?? "Kipilote"}
      logoUrl={branding?.logo_url ?? null}
      primaryColor={resolveColor(branding?.primary_color)}
      hasBranding={Boolean(branding)}
    />
  );
}

async function fetchBranding(slug: string): Promise<CompanyBrandingRow | null> {
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

  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("nom, slug, logo_url, primary_color")
    .eq("slug", slug)
    .maybeSingle<CompanyBrandingRow>();

  if (error || !data) return null;
  return data;
}

function resolveColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_PRIMARY_COLOR;
  const color = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : DEFAULT_PRIMARY_COLOR;
}
