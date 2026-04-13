import "server-only";

import { cookies } from "next/headers";
import {
  getIdentitySessionSecret,
  IDENTITY_SESSION_COOKIE,
  type IdentitySessionPayload,
  verifyIdentitySessionToken,
} from "@/app/utils/identitySession";
import { type AppRole } from "@/app/security/permissions";

export async function getCurrentIdentity(): Promise<IdentitySessionPayload | null> {
  const secret = getIdentitySessionSecret();
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(IDENTITY_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifyIdentitySessionToken(token, secret);
}

export async function getCurrentClientRole(): Promise<AppRole | null> {
  const identity = await getCurrentIdentity();
  if (!identity || identity.isHqStaff || identity.universe !== "client") {
    return null;
  }

  return identity.role;
}
