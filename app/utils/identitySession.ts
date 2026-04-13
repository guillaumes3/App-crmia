import { createHmac, timingSafeEqual } from "node:crypto";
import { type AppRole, resolveAppRole } from "@/app/security/permissions";
import { isValidCompanySlug, normalizeCompanySlug } from "@/app/utils/companySlug";

export const IDENTITY_SESSION_COOKIE = "kipilote_identity";
export const IDENTITY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type UserUniverse = "hq" | "client";

export type HqIdentitySessionPayload = {
  sub: string;
  email?: string;
  isHqStaff: true;
  universe: "hq";
  exp: number;
};

export type ClientIdentitySessionPayload = {
  sub: string;
  email?: string;
  isHqStaff: false;
  organisationId: string;
  organisationSlug: string;
  universe: "client";
  role: AppRole;
  exp: number;
};

export type IdentitySessionPayload = HqIdentitySessionPayload | ClientIdentitySessionPayload;

type MetadataLike = Record<string, unknown> | null | undefined;

type UserLike = {
  id: string;
  email?: string | null;
  user_metadata?: MetadataLike;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getIdentitySessionSecret(): string | null {
  return process.env.IDENTITY_SESSION_SECRET ?? process.env.HQ_SESSION_SECRET ?? null;
}

export function buildIdentitySessionPayload(user: UserLike, exp: number): IdentitySessionPayload | null {
  if (!user.id || typeof exp !== "number" || Number.isNaN(exp)) {
    return null;
  }

  const metadata = normalizeMetadata(user.user_metadata);
  const isHqStaff = readBoolean(metadata.is_hq_staff) === true;
  const organisationId = readOrganisationId(metadata.organisation_id);
  const organisationSlug = readOrganisationSlug(metadata.organisation_slug);

  if (isHqStaff) {
    return {
      sub: user.id,
      email: normalizeEmail(user.email),
      isHqStaff: true,
      universe: "hq",
      exp,
    };
  }

  if (!organisationId || !organisationSlug) {
    return null;
  }

  return {
    sub: user.id,
    email: normalizeEmail(user.email),
    isHqStaff: false,
    organisationId,
    organisationSlug,
    universe: "client",
    role: resolveAppRole(metadata.role),
    exp,
  };
}

export function createIdentitySessionToken(payload: IdentitySessionPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyIdentitySessionToken(token: string, secret: string): IdentitySessionPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<
      IdentitySessionPayload
    >;
    const sub = typeof parsed.sub === "string" ? parsed.sub : "";
    const universe = parsed.universe === "hq" || parsed.universe === "client" ? parsed.universe : null;
    const exp = typeof parsed.exp === "number" ? parsed.exp : NaN;

    if (!sub || !universe || Number.isNaN(exp) || exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (parsed.isHqStaff === true && universe === "hq") {
      return {
        sub,
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        isHqStaff: true,
        universe: "hq",
        exp,
      };
    }

    if (
      parsed.isHqStaff === false &&
      universe === "client" &&
      isValidOrganisationId(parsed.organisationId) &&
      isValidOrganisationSlug(parsed.organisationSlug)
    ) {
      return {
        sub,
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        isHqStaff: false,
        organisationId: parsed.organisationId,
        organisationSlug: parsed.organisationSlug,
        universe: "client",
        role: resolveAppRole(parsed.role),
        exp,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeMetadata(metadata: MetadataLike): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return metadata;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function readOrganisationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isValidOrganisationId(trimmed)) {
    return null;
  }
  return trimmed;
}

function readOrganisationSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCompanySlug(value);
  return isValidOrganisationSlug(normalized) ? normalized : null;
}

function isValidOrganisationId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isValidOrganisationSlug(value: unknown): value is string {
  return typeof value === "string" && isValidCompanySlug(value);
}

function normalizeEmail(email: string | null | undefined): string | undefined {
  if (typeof email !== "string") return undefined;
  const trimmed = email.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
