import { NextResponse, type NextRequest } from "next/server";
import {
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  verifyIdentitySessionToken,
} from "@/app/utils/identitySession";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isHqLoginRoute = pathname === "/hq/login";
  const isHqRoute = pathname.startsWith("/hq");
  const isBackofficeRoute = pathname.startsWith("/backoffice");

  if (isHqLoginRoute) {
    return NextResponse.next();
  }

  if (!isHqRoute && !isBackofficeRoute) {
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

  headers.set("x-kipilote-org-id", identity.organisationId);

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

function redirectTo404(request: NextRequest) {
  return NextResponse.redirect(new URL("/404", request.url));
}

export const config = {
  matcher: ["/hq/:path*", "/backoffice/:path*"],
};
