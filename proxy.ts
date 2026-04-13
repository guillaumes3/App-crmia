import { NextResponse, type NextRequest } from "next/server";
import {
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  verifyIdentitySessionToken,
} from "@/app/utils/identitySession";
import { getRequiredPermissionForPath, hasPermission } from "@/app/security/permissions";
import { isValidCompanySlug, normalizeCompanySlug } from "@/app/utils/companySlug";

const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "hq"]);
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "").trim().toLowerCase();

export function proxy(request: NextRequest) {
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

  const headers = new Headers(request.headers);
  headers.set("x-kipilote-user-id", identity.sub);
  headers.set("x-kipilote-universe", identity.universe);

  if (isHqRoute) {
    if (!identity.isHqStaff || identity.universe !== "hq") {
      return redirectTo404(request);
    }

    return NextResponse.next({
      request: {
        headers,
      },
    });
  }

  if (identity.isHqStaff) {
    return NextResponse.redirect(new URL("/hq/staff", request.url));
  }

  if (identity.universe !== "client" || !identity.organisationId) {
    return redirectTo404(request);
  }

  // Multi-tenant hard check: if request comes from a tenant subdomain,
  // the signed session slug must match that tenant.
  if (tenantSlug && identity.organisationSlug !== tenantSlug) {
    return redirectTo404(request);
  }

  headers.set("x-kipilote-org-id", identity.organisationId);
  headers.set("x-kipilote-org-slug", identity.organisationSlug);
  headers.set("x-kipilote-role", identity.role);

  const requiredPermission = getRequiredPermissionForPath(pathname);
  if (requiredPermission && !hasPermission(identity.role, requiredPermission)) {
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
