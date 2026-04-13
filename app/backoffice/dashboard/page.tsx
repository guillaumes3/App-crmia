import RoleGuard from "@/app/components/RoleGuard";
import DashboardClient from "@/app/backoffice/dashboard/DashboardClient";

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={["Administrateur", "Manager"]}>
      <DashboardClient />
    </RoleGuard>
  );
}
