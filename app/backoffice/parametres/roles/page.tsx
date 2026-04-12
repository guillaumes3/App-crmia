"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";

const traductions: Record<string, string> = {
  can_view_stock: "Voir le stock",
  can_edit_stock: "Modifier le stock",
  can_view_sales: "Consulter les ventes",
  can_create_sales: "Enregistrer des ventes",
  can_view_dashboard: "Acceder au tableau de bord",
  can_manage_users: "Gerer les utilisateurs",
};

interface PermissionsState {
  can_view_stock: boolean;
  can_edit_stock: boolean;
  can_view_sales: boolean;
  can_create_sales: boolean;
  can_view_dashboard: boolean;
  can_manage_users: boolean;
}

export default function GestionRoles() {
  const [nomRole, setNomRole] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionsState>({
    can_view_stock: true,
    can_edit_stock: false,
    can_view_sales: true,
    can_create_sales: true,
    can_view_dashboard: false,
    can_manage_users: false,
  });

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || isKipiloteStaff(user)) {
        setOrgId(null);
        return;
      }

      setOrgId(getOrganisationId(user));
    };
    void getSession();
  }, []);

  const togglePermission = (key: keyof PermissionsState) => {
    setPermissions((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const enregistrerRole = async () => {
    if (!orgId) {
      alert("Erreur : Organisation non identifiee");
      return;
    }

    if (!nomRole) {
      alert("Veuillez donner un nom au role");
      return;
    }

    const { error } = await supabase.from("roles_personnalises").insert([
      {
        nom_role: nomRole,
        organisation_id: orgId,
        ...permissions,
      },
    ]);

    if (error) alert(error.message);
    else {
      alert("Role cree avec succes");
      setNomRole("");
    }
  };

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Roles & permissions</h1>
          <p style={pageSubtitleStyle}>Definissez des profils d acces adaptes a chaque collaborateur.</p>
        </div>
      </header>

      <div style={panelStyle}>
        <div style={fieldWrapStyle}>
          <label style={labelStyle}>Nom du role</label>
          <input
            placeholder="Exemple: Magasinier, Commercial Junior..."
            value={nomRole}
            onChange={(event) => setNomRole(event.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={gridPermissionsStyle}>
          {(Object.keys(permissions) as Array<keyof PermissionsState>).map((permissionKey) => (
            <div key={permissionKey} style={permissionLineStyle}>
              <span style={permissionLabelStyle}>{traductions[permissionKey]}</span>
              <input
                type="checkbox"
                checked={permissions[permissionKey]}
                onChange={() => togglePermission(permissionKey)}
                style={checkboxStyle}
              />
            </div>
          ))}
        </div>

        <button onClick={enregistrerRole} style={submitButtonStyle}>
          Enregistrer le role
        </button>
      </div>
    </div>
  );
}

const cardShadow = "0 16px 32px -25px rgba(15, 23, 42, 0.28)";

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const pageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "1.52rem",
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  background: "#ffffff",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  outline: "none",
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

const gridPermissionsStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const permissionLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  background: "#f8fafc",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
};

const permissionLabelStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 700,
};

const checkboxStyle: React.CSSProperties = {
  width: "20px",
  height: "20px",
  cursor: "pointer",
  accentColor: "#4338ca",
};

const submitButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
  fontSize: "0.9rem",
};
