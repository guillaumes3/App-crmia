"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <div style={containerStyle}>
      <Link href="/backoffice/parametres" style={backLinkStyle}>
        Retour aux parametres
      </Link>

      <h1 style={titlePageStyle}>Configuration des Roles</h1>
      <p style={subtitleStyle}>Definissez les acces personnalises pour votre equipe.</p>

      <div style={cardStyle}>
        <label style={labelStyle}>Nom du role</label>
        <input
          placeholder="Exemple: Magasinier, Commercial Junior..."
          value={nomRole}
          onChange={(event) => setNomRole(event.target.value)}
          style={inputStyle}
        />

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

const containerStyle: React.CSSProperties = {
  animation: "fadeIn 0.3s ease-in-out",
};

const backLinkStyle: React.CSSProperties = {
  color: "#6366f1",
  textDecoration: "none",
  fontSize: "0.8rem",
  fontWeight: 700,
  display: "block",
  marginBottom: "15px",
};

const titlePageStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "1.5rem",
  marginBottom: "10px",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginBottom: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  padding: "30px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  maxWidth: "600px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "0.75rem",
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  marginBottom: "25px",
  outline: "none",
  fontSize: "1rem",
  boxSizing: "border-box",
};

const gridPermissionsStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginBottom: "30px",
};

const permissionLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 15px",
  background: "#f8fafc",
  borderRadius: "12px",
  border: "1px solid #f1f5f9",
};

const permissionLabelStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 600,
};

const checkboxStyle: React.CSSProperties = {
  width: "20px",
  height: "20px",
  cursor: "pointer",
  accentColor: "#6366f1",
};

const submitButtonStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "white",
  border: "none",
  padding: "14px 25px",
  borderRadius: "12px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
  fontSize: "0.9rem",
};
