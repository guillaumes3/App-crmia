export const getAccessLevel = (role: string, page: string) => {
  const permissions: Record<string, any> = {
    "Administrateur": { all: "full" },
    "Gestionnaire Stock": { dashboard: "full", articles: "full", commandes: "full", ventes: "read", clients: "read" },
    "Commercial": { dashboard: "full", ventes: "full", clients: "full", articles: "read" }
  };

  const access = permissions[role]?.[page] || permissions[role]?.all;
  return access || "none"; // "full", "read", ou "none"
};