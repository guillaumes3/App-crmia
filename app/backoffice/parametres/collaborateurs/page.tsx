"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";

type CollaborateurRow = {
  id: string;
  organisation_id?: string | null;
  nom?: string | null;
  prenom?: string | null;
  equipe?: string | null;
  role?: string | null;
};

export default function CollaborateursPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [collabList, setCollabList] = useState<CollaborateurRow[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<CollaborateurRow | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || isKipiloteStaff(session.user)) {
      setCollabList([]);
      return;
    }

    const sessionOrgId = getOrganisationId(session.user);
    if (!sessionOrgId) {
      setCollabList([]);
      return;
    }

    setOrgId(sessionOrgId);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("organisation_id", sessionOrgId)
      .order("prenom", { ascending: true });

    if (data) {
      setCollabList(data as CollaborateurRow[]);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleUpdate = async () => {
    if (!selectedCollab || !orgId) return;
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nom: selectedCollab.nom,
        prenom: selectedCollab.prenom,
        equipe: selectedCollab.equipe,
        role: selectedCollab.role,
      })
      .eq("id", selectedCollab.id)
      .eq("organisation_id", orgId);

    if (error) alert("Erreur : " + error.message);
    else {
      alert("Enregistre.");
      setSelectedCollab(null);
      await loadData();
    }
    setLoading(false);
  };

  return (
    <div style={layoutStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Membres de l organisation</h2>
        {collabList.length === 0 ? (
          <p style={emptyHintStyle}>Aucun membre (table vide).</p>
        ) : (
          collabList.map((collab) => (
            <div key={collab.id} style={itemStyle}>
              <div style={itemIdentityStyle}>
                <div style={itemNameStyle}>
                  {collab.prenom || ""} {collab.nom || "Sans nom"}
                </div>
                <div style={itemRoleStyle}>{collab.role || "Collaborateur"}</div>
              </div>
              <div style={menuWrapStyle}>
                <button onClick={() => setActiveMenu(activeMenu === collab.id ? null : collab.id)} style={burgerButtonStyle}>
                  ⋮
                </button>
                {activeMenu === collab.id ? (
                  <div style={dropdownStyle}>
                    <div
                      style={dropdownItemStyle}
                      onClick={() => {
                        setSelectedCollab(collab);
                        setActiveMenu(null);
                      }}
                    >
                      Modifier
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Details du profil</h2>
        {selectedCollab ? (
          <div style={formStyle}>
            <input
              style={inputStyle}
              value={selectedCollab.prenom || ""}
              onChange={(event) => setSelectedCollab({ ...selectedCollab, prenom: event.target.value })}
              placeholder="Prenom"
            />
            <input
              style={inputStyle}
              value={selectedCollab.nom || ""}
              onChange={(event) => setSelectedCollab({ ...selectedCollab, nom: event.target.value })}
              placeholder="Nom"
            />
            <input
              style={inputStyle}
              value={selectedCollab.equipe || ""}
              onChange={(event) => setSelectedCollab({ ...selectedCollab, equipe: event.target.value })}
              placeholder="Equipe"
            />
            <button onClick={handleUpdate} disabled={loading} style={saveButtonStyle}>
              {loading ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        ) : (
          <div style={emptyStateStyle}>Selectionnez "Modifier" via le menu ⋮</div>
        )}
      </div>
    </div>
  );
}

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  padding: "25px",
  borderRadius: "15px",
  border: "1px solid #e2e8f0",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 900,
  marginBottom: "20px",
};

const emptyHintStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.9rem",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "10px",
  marginBottom: "8px",
};

const itemIdentityStyle: React.CSSProperties = {
  flex: 1,
};

const itemNameStyle: React.CSSProperties = {
  fontWeight: 800,
};

const itemRoleStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#64748b",
};

const menuWrapStyle: React.CSSProperties = {
  position: "relative",
};

const burgerButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "1.2rem",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "25px",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  zIndex: 10,
  minWidth: "100px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
};

const dropdownItemStyle: React.CSSProperties = {
  padding: "10px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 700,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  outline: "none",
};

const saveButtonStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "white",
  border: "none",
  padding: "12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#94a3b8",
  marginTop: "50px",
};
