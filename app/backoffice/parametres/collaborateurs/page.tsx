"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";

type CollaborateurRow = {
  id: string;
  organisation_id?: string | null;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  equipe?: string | null;
  role?: string | null;
};

type CreateCollaborateurForm = {
  prenom: string;
  nom: string;
  email: string;
  role: string;
};

const defaultCreateForm: CreateCollaborateurForm = {
  prenom: "",
  nom: "",
  email: "",
  role: "Collaborateur",
};

export default function CollaborateursPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [collabList, setCollabList] = useState<CollaborateurRow[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<CollaborateurRow | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCollaborateurForm>(defaultCreateForm);
  const [loading, setLoading] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

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

  const handleCreate = async () => {
    if (!orgId) {
      alert("Organisation introuvable.");
      return;
    }
    if (!createForm.prenom.trim() || !createForm.nom.trim() || !createForm.role.trim()) {
      alert("Prenom, nom et role sont obligatoires.");
      return;
    }
    if (!isValidEmail(createForm.email)) {
      alert("Email invalide.");
      return;
    }

    setLoading(true);

    // Etape 1 : tentative d invitation (si la methode est disponible et autorisee).
    let inviteWarning = "";
    try {
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(createForm.email.trim().toLowerCase(), {
        data: {
          organisation_id: orgId,
          prenom: createForm.prenom.trim(),
          nom: createForm.nom.trim(),
          role: createForm.role.trim(),
        },
      });
      if (inviteError) {
        inviteWarning = inviteError.message;
      }
    } catch (error) {
      inviteWarning = error instanceof Error ? error.message : "Invitation non disponible.";
    }

    // Etape 2 : fallback test, insertion d un profil rattache a l organisation courante.
    const { error: insertError } = await supabase.from("profiles").insert({
      organisation_id: orgId,
      prenom: createForm.prenom.trim(),
      nom: createForm.nom.trim(),
      email: createForm.email.trim().toLowerCase(),
      role: createForm.role.trim(),
    });

    if (insertError) {
      alert("Erreur creation membre : " + insertError.message);
      setLoading(false);
      return;
    }

    setCreateForm(defaultCreateForm);
    setIsCreating(false);
    setSelectedCollab(null);
    await loadData();
    setLoading(false);

    if (inviteWarning) {
      alert("Membre cree dans profiles. Invitation non envoyee: " + inviteWarning);
      return;
    }
    alert("Membre ajoute et invitation traitee.");
  };

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Collaborateurs</h1>
          <p style={pageSubtitleStyle}>Gestion des profils, equipes et niveaux d acces.</p>
        </div>
      </header>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={panelStyle}>
          <div style={panelHeaderRowStyle}>
            <h2 style={panelTitleStyle}>Membres de l organisation</h2>
            <button
              type="button"
              style={addMemberButtonStyle}
              onClick={() => {
                setCreateForm(defaultCreateForm);
                setIsCreating(true);
                setSelectedCollab(null);
                setActiveMenu(null);
              }}
            >
              <span style={plusIconStyle}>+</span> Ajouter un membre
            </button>
          </div>
          {collabList.length === 0 ? (
            <p style={emptyHintStyle}>Aucun membre (table vide).</p>
          ) : (
            collabList.map((collab) => (
              <article key={collab.id} style={itemStyle}>
                <button
                  type="button"
                  style={itemIdentityButtonStyle}
                  onClick={() => {
                    setSelectedCollab(collab);
                    setIsCreating(false);
                    setActiveMenu(null);
                  }}
                >
                  <div style={itemNameStyle}>
                    {collab.prenom || ""} {collab.nom || "Sans nom"}
                  </div>
                  <div style={itemRoleStyle}>{collab.role || "Collaborateur"}</div>
                </button>

                <div style={menuWrapStyle}>
                  <button onClick={() => setActiveMenu(activeMenu === collab.id ? null : collab.id)} style={burgerButtonStyle}>
                    ⋮
                  </button>
                  {activeMenu === collab.id ? (
                    <div style={dropdownStyle}>
                      <button
                        type="button"
                        style={dropdownItemStyle}
                        onClick={() => {
                          setSelectedCollab(collab);
                          setIsCreating(false);
                          setActiveMenu(null);
                        }}
                      >
                        Modifier
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={panelTitleStyle}>{isCreating ? "Mode Creation" : "Mode Edition"}</h2>
          {isCreating ? (
            <div style={formStyle}>
              <input
                style={inputStyle}
                value={createForm.prenom}
                onChange={(event) => setCreateForm({ ...createForm, prenom: event.target.value })}
                placeholder="Prenom"
              />
              <input
                style={inputStyle}
                value={createForm.nom}
                onChange={(event) => setCreateForm({ ...createForm, nom: event.target.value })}
                placeholder="Nom"
              />
              <input
                style={inputStyle}
                value={createForm.email}
                onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                placeholder="Email"
                type="email"
              />
              <input
                style={inputStyle}
                value={createForm.role}
                onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
                placeholder="Role"
              />
              <button onClick={handleCreate} disabled={loading} style={saveButtonStyle}>
                {loading ? "Creation..." : "Ajouter"}
              </button>
            </div>
          ) : selectedCollab ? (
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
              <input
                style={inputStyle}
                value={selectedCollab.role || ""}
                onChange={(event) => setSelectedCollab({ ...selectedCollab, role: event.target.value })}
                placeholder="Role"
              />
              <button onClick={handleUpdate} disabled={loading} style={saveButtonStyle}>
                {loading ? "Enregistrement..." : "Sauvegarder"}
              </button>
            </div>
          ) : (
            <div style={emptyStateStyle}>Selectionnez un collaborateur a gauche ou ajoutez un membre.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
});

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 900,
  fontSize: "1.04rem",
};

const panelHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const addMemberButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "14px",
  padding: "9px 12px",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 12px 22px -16px rgba(49, 46, 129, 0.75)",
};

const plusIconStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.18)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  lineHeight: 1,
};

const emptyHintStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.9rem",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  gap: "10px",
};

const itemIdentityButtonStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
};

const itemNameStyle: React.CSSProperties = {
  fontWeight: 900,
  color: "#0f172a",
};

const itemRoleStyle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "0.76rem",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 800,
};

const menuWrapStyle: React.CSSProperties = {
  position: "relative",
};

const burgerButtonStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: "1rem",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "38px",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  zIndex: 10,
  minWidth: "120px",
  boxShadow: cardShadow,
};

const dropdownItemStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "#f8fafc",
  borderRadius: "8px",
  padding: "8px 10px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 800,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  outline: "none",
};

const saveButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "10px 14px",
  borderRadius: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  minHeight: "140px",
  border: "1px dashed #cbd5e1",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#94a3b8",
  background: "#f8fafc",
};
