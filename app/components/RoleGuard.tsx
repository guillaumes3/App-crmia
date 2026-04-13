import { type ReactNode } from "react";
import { getCurrentClientRole } from "@/app/security/currentIdentity";
import { isRoleAllowed, type AppRole } from "@/app/security/permissions";

type RoleGuardProps = {
  allowedRoles: readonly AppRole[];
  children: ReactNode;
};

export async function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const role = await getCurrentClientRole();

  if (!role || !isRoleAllowed(role, allowedRoles)) {
    return null;
  }

  return <>{children}</>;
}

export default RoleGuard;
