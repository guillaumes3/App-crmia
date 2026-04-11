import type { User } from "@supabase/supabase-js";

export type UserMetadata = Record<string, unknown> & {
  is_hq_staff?: boolean | string | null;
  organisation_id?: string | null;
  nom?: string | null;
  prenom?: string | null;
  role?: string | null;
  role_hq?: string | null;
};

export type KipiloteStaff = Omit<User, "user_metadata"> & {
  user_metadata: UserMetadata & {
    is_hq_staff: true;
    organisation_id?: string | null;
  };
};

export type ClientUser = Omit<User, "user_metadata"> & {
  user_metadata: UserMetadata & {
    is_hq_staff?: false | null;
    organisation_id: string;
  };
};

function readUserMetadata(user: User | null | undefined): UserMetadata {
  if (!user?.user_metadata || typeof user.user_metadata !== "object") {
    return {};
  }

  return user.user_metadata as UserMetadata;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function normalizeOrganisationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isKipiloteStaff(user: User | null | undefined): user is KipiloteStaff {
  const metadata = readUserMetadata(user);
  return normalizeBoolean(metadata.is_hq_staff) === true;
}

export function isClientUser(user: User | null | undefined): user is ClientUser {
  if (!user) return false;

  const metadata = readUserMetadata(user);
  const isHqStaff = normalizeBoolean(metadata.is_hq_staff) === true;
  if (isHqStaff) {
    return false;
  }

  const organisationId = normalizeOrganisationId(metadata.organisation_id);
  return organisationId !== null;
}

export function getOrganisationId(user: User | null | undefined): string | null {
  const metadata = readUserMetadata(user);
  return normalizeOrganisationId(metadata.organisation_id);
}
