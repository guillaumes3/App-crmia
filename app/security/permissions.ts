export const APP_ROLES = ["Administrateur", "Manager", "Vendeur"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PERMISSION_KEYS = [
  "CAN_VIEW_DASHBOARD",
  "CAN_VIEW_STOCK",
  "CAN_VIEW_SUPPLIERS",
  "CAN_VIEW_ORDERS",
  "CAN_VIEW_CLIENTS",
  "CAN_VIEW_SALES",
  "CAN_MANAGE_USERS",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_PERMISSIONS: Record<AppRole, readonly PermissionKey[]> = {
  Administrateur: PERMISSION_KEYS,
  Manager: [
    "CAN_VIEW_DASHBOARD",
    "CAN_VIEW_STOCK",
    "CAN_VIEW_SUPPLIERS",
    "CAN_VIEW_ORDERS",
    "CAN_VIEW_CLIENTS",
    "CAN_VIEW_SALES",
    "CAN_MANAGE_USERS",
  ],
  Vendeur: [
    "CAN_VIEW_STOCK",
    "CAN_VIEW_SUPPLIERS",
    "CAN_VIEW_ORDERS",
    "CAN_VIEW_CLIENTS",
    "CAN_VIEW_SALES",
  ],
};

const ROLE_ALIASES: Record<string, AppRole> = {
  administrateur: "Administrateur",
  admin: "Administrateur",
  manager: "Manager",
  gestionnaire: "Manager",
  vendeur: "Vendeur",
  commercial: "Vendeur",
  collaborateur: "Vendeur",
};

function normalizeRoleLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function parseAppRole(value: unknown): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }

  return ROLE_ALIASES[normalizeRoleLabel(value)] ?? null;
}

export function resolveAppRole(value: unknown, fallback: AppRole = "Vendeur"): AppRole {
  return parseAppRole(value) ?? fallback;
}

export function hasPermission(role: AppRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isRoleAllowed(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}

export function getRequiredPermissionForPath(pathname: string): PermissionKey | null {
  if (pathname === "/dashboard" || pathname === "/backoffice/dashboard" || pathname.startsWith("/backoffice/dashboard/")) {
    return "CAN_VIEW_DASHBOARD";
  }

  return null;
}
