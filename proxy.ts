import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  verifyIdentitySessionToken,
} from "@/app/utils/identitySession";
import { getRequiredPermissionForPath, hasPermission, resolveAppRole, type AppRole } from "@/app/security/permissions";
import { isValidCompanySlug, normalizeCompanySlug } from "@/app/utils/companySlug";
import { SUPABASE_URL } from "@/app/utils/supabase";

const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "hq"]);
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "").trim().toLowerCase();

type ProfileLookupRow = {
  organisation_id: string | null;
  is_hq_staff: boolean | null;
  role: string | null;
};

type OrganisationLookupRow = {
  slug: string | null;
  status?: string | null;
  statut?: string | null;
};

type LiveAccessContext = {
  isHqStaff: boolean;
  organisationId: string | null;
  organisationSlug: string | null;
  organisationStatus: "active" | "suspended";
  role: AppRole;
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const tenantSlug = extractTenantSlug(request);

  const rewritten = rewriteTenantEntryRoutes(request, pathname, tenantSlug);
  if (rewritten) {
    return rewritten;
  }

  const isHqLoginRoute = pathname === "/hq/login";
  const isHqRoute = pathname.startsWith("/hq");
  const isBackofficeRoute = pathname.startsWith("/backoffice");
  const isLegacyDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isHqLoginRoute) {
    return NextResponse.next();
  }

  if (!isHqRoute && !isBackofficeRoute && !isLegacyDashboardRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(IDENTITY_SESSION_COOKIE)?.value;
  const secret = getIdentitySessionSecret();
  const identity = token && secret ? verifyIdentitySessionToken(token, secret) : null;

  if (!identity) {
    return redirectTo404(request);
  }

  const access = await getLiveAccessContext(identity.sub, identity.email ?? null);
  if (!access) {
    return redirectTo404(request);
  }

  const headers = new Headers(request.headers);
  headers.set("x-kipilote-user-id", identity.sub);
  headers.set("x-kipilote-universe", access.isHqStaff ? "hq" : "client");

  if (isHqRoute) {
    if (!access.isHqStaff || identity.universe !== "hq") {
      return redirectTo404(request);
    }

    return NextResponse.next({
      request: {
        headers,
      },
    });
  }

  if (access.isHqStaff) {
    return NextResponse.redirect(new URL("/hq/staff", request.url));
  }

  if (identity.universe !== "client") {
    return redirectTo404(request);
  }

  if (!access.organisationId || !access.organisationSlug) {
    return redirectTo404(request);
  }

  // Multi-tenant hard check: if request comes from a tenant subdomain,
  // the organisation resolved from DB must match that tenant.
  if (tenantSlug && access.organisationSlug !== tenantSlug) {
    return redirectTo404(request);
  }

  if (access.organisationStatus !== "active") {
    return NextResponse.redirect(new URL("/error/suspended", request.url));
  }

  headers.set("x-kipilote-org-id", access.organisationId);
  headers.set("x-kipilote-org-slug", access.organisationSlug);
  headers.set("x-kipilote-role", access.role);

  const requiredPermission = getRequiredPermissionForPath(pathname);
  if (requiredPermission && !hasPermission(access.role, requiredPermission)) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/backoffice/dashboard", request.url));
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

async function getLiveAccessContext(userId: string, email: string | null): Promise<LiveAccessContext | null> {
  const supabaseAdmin = createProxySupabaseAdminClient();
  if (!supabaseAdmin) {
    return null;
  }

  const profile = await findProfileByIdentity(supabaseAdmin, { userId, email });
  if (!profile) {
    return null;
  }

  const isHqStaff = profile.is_hq_staff === true;
  if (isHqStaff) {
    return {
      isHqStaff: true,
      organisationId: null,
      organisationSlug: null,
      organisationStatus: "active",
      role: resolveAppRole(profile.role),
    };
  }

  const organisationId = normalizeText(profile.organisation_id);
  if (!organisationId) {
    return null;
  }

  const organisation = await findOrganisationById(supabaseAdmin, organisationId);
  if (!organisation || !organisation.slug) {
    return null;
  }

  return {
    isHqStaff: false,
    organisationId,
    organisationSlug: organisation.slug,
    organisationStatus: organisation.status,
    role: resolveAppRole(profile.role),
  };
}

function createProxySupabaseAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return null;
  }

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type IdentityLookup = {
  userId: string;
  email: string | null;
};

async function findProfileByIdentity(
  supabaseAdmin: SupabaseClient,
  identity: IdentityLookup,
): Promise<ProfileLookupRow | null> {
  const selectFields = "organisation_id, is_hq_staff, role";

  const attempts: Array<() => Promise<{ data: ProfileLookupRow | null; error: { code?: string; message?: string } | null }>> = [
    async () =>
      await supabaseAdmin
        .from("profiles")
        .select(selectFields)
        .eq("id", identity.userId)
        .maybeSingle<ProfileLookupRow>(),
    async () =>
      await supabaseAdmin
        .from("profiles")
        .select(selectFields)
        .eq("auth_user_id", identity.userId)
        .maybeSingle<ProfileLookupRow>(),
    async () =>
      await supabaseAdmin
        .from("profiles")
        .select(selectFields)
        .eq("user_id", identity.userId)
        .maybeSingle<ProfileLookupRow>(),
  ];

  if (identity.email) {
    attempts.push(async () =>
      await supabaseAdmin
        .from("profiles")
        .select(selectFields)
        .ilike("email", identity.email ?? "")
        .maybeSingle<ProfileLookupRow>(),
    );
  }

  for (const attempt of attempts) {
    const { data, error } = await attempt();

    if (data) {
      return data;
    }

    if (error && !isRecoverableLookupError(error)) {
      return null;
    }
  }

  return null;
}

async function findOrganisationById(
  supabaseAdmin: SupabaseClient,
  organisationId: string,
): Promise<{ slug: string | null; status: "active" | "suspended" } | null> {
  const byStatus = await supabaseAdmin
    .from("organisations")
    .select("slug, status")
    .eq("id", organisationId)
    .maybeSingle<OrganisationLookupRow>();

  if (!byStatus.error) {
    return {
      slug: normalizeCompanySlug(byStatus.data?.slug ?? "") || null,
      status: normalizeOrganisationStatus(byStatus.data?.status),
    };
  }

  if (!isRecoverableLookupError(byStatus.error)) {
    return null;
  }

  const byLegacyStatus = await supabaseAdmin
    .from("organisations")
    .select("slug, statut")
    .eq("id", organisationId)
    .maybeSingle<OrganisationLookupRow>();

  if (byLegacyStatus.error) {
    return null;
  }

  return {
    slug: normalizeCompanySlug(byLegacyStatus.data?.slug ?? "") || null,
    status: normalizeOrganisationStatus(byLegacyStatus.data?.statut),
  };
}

function normalizeOrganisationStatus(raw: unknown): "active" | "suspended" {
  if (typeof raw !== "string") {
    return "active";
  }

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (normalized === "active" || normalized === "actif") {
    return "active";
  }

  return "suspended";
}

function isRecoverableLookupError(error: { code?: string; message?: string }): boolean {
  const raw = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return raw.includes("22p02") || raw.includes("42703") || raw.includes("column");
}

function normalizeText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function extractTenantSlug(request: NextRequest): string | null {
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();

  if (!hostname) return null;

  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length).split(".")[0] ?? "";
    return normalizeTenantSlug(sub);
  }

  if (APP_DOMAIN && hostname.endsWith(`.${APP_DOMAIN}`)) {
    const sub = hostname.slice(0, hostname.length - APP_DOMAIN.length - 1).split(".")[0] ?? "";
    return normalizeTenantSlug(sub);
  }

  if (!APP_DOMAIN) {
    const parts = hostname.split(".");
    if (parts.length >= 3 && !hostname.endsWith(".vercel.app")) {
      return normalizeTenantSlug(parts[0] ?? "");
    }
  }

  return null;
}

function normalizeTenantSlug(candidate: string): string | null {
  const normalized = normalizeCompanySlug(candidate);
  if (!normalized) return null;
  if (RESERVED_SUBDOMAINS.has(normalized)) return null;
  if (!isValidCompanySlug(normalized)) return null;
  return normalized;
}

function rewriteTenantEntryRoutes(request: NextRequest, pathname: string, tenantSlug: string | null): NextResponse | null {
  if (!tenantSlug) return null;

  if (pathname.startsWith("/companies/")) {
    return null;
  }

  if (pathname === "/") {
    return NextResponse.rewrite(new URL(`/companies/${tenantSlug}`, request.url));
  }

  if (pathname === "/login") {
    return NextResponse.rewrite(new URL(`/companies/${tenantSlug}/login`, request.url));
  }

  return null;
}

function redirectTo404(request: NextRequest) {
  return NextResponse.redirect(new URL("/404", request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
