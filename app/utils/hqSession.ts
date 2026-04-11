import { createHmac, timingSafeEqual } from "node:crypto";

export const HQ_SESSION_COOKIE = "hq_session";
export const HQ_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const HQ_ROLES = ["Admin", "Admin HQ", "Support", "Account_Manager"] as const;

export type HqRole = (typeof HQ_ROLES)[number];

export type HqSessionPayload = {
  sub: string;
  email?: string;
  role: HqRole;
  isHqStaff: boolean;
  exp: number;
};

export function normalizeHqRole(value: string | null | undefined): HqRole | null {
  if (!value) return null;
  if ((HQ_ROLES as readonly string[]).includes(value)) {
    return value as HqRole;
  }
  return null;
}

export function getHqSessionSecret(): string | null {
  return process.env.HQ_SESSION_SECRET ?? null;
}

export function getHqRedirectByRole(role: HqRole): string {
  if (role === "Admin" || role === "Admin HQ") return "/hq/staff?view=admin";
  if (role === "Support") return "/hq/staff?view=support";
  return "/hq/staff?view=account-manager";
}

export function createHqSessionToken(payload: HqSessionPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyHqSessionToken(token: string, secret: string): HqSessionPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as HqSessionPayload;
    const role = normalizeHqRole(parsed.role);
    if (!role || !parsed.sub || !parsed.isHqStaff) return null;
    if (typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      role,
      isHqStaff: true,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
