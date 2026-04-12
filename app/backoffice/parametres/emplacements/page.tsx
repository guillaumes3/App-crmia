"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";

interface EmplacementRow {
  id: string;
  nom: string;
  type: string | null;
  capacite: number | null;
}

interface EmplacementDraft {
  nom: string;
  type: string;
  capacite: number;
}

const initialDraft: EmplacementDraft = {
  nom: "",
  type: "depot",
  capacite: 0,
};

export default function EmplacementsPage() {
  const [orgId, setOrgId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emplacementList, setEmplacementList] = useState<EmplacementRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<EmplacementDraft>(initialDraft);

  const loadData = useCallback(async (id: string) => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("emplacements")
      .select("id, nom, type, capacite")
      .eq("organisation_id", id)
      .order("nom", { ascending: true });

    if (error) {
      alert(error.message);
      setLoadingList(false);
      return;
    }

    setEmplacementList((data ?? []) as EmplacementRow[]);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const organisationId = session?.user?.user_metadata?.organisation_id as string | undefined;
      if (organisationId == null) {
        return;
      }

      setOrgId(organisationId);
      await loadData(organisationId);
    };

    void init();
  }, [loadData]);

  const selectForEdit = (item: EmplacementRow) => {
    setSelectedItem(item.id);
    setIsCreating(false);
    setDraft({
      nom: item.nom ?? "",
      type: item.type ?? "depot",
      capacite: item.capacite ?? 0,
    });
    setActiveMenu(null);
  };

  const selectForCreate = () => {
    setSelectedItem("new");
    setIsCreating(true);
    setDraft(initialDraft);
    setActiveMenu(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (orgId.length === 0) {
      alert("Organisation introuvable.");
      return;
    }

    if (draft.nom.trim().length === 0) {
      alert("Le nom de l'emplacement est obligatoire.");
      return;
    }

    setSaving(true);

    if (isCreating) {
      const { data, error } = await supabase
        .from("emplacements")
        .insert([
          {
            organisation_id: orgId,
            nom: draft.nom.trim(),
            type: draft.type,
            capacite: draft.capacite,
          },
        ])
        .select("id, nom, type, capacite")
        .single();

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      await loadData(orgId);

      const createdRow = data as EmplacementRow;
      setSelectedItem(createdRow.id);
      setIsCreating(false);
      setDraft({
        nom: createdRow.nom ?? "",
        type: createdRow.type ?? "depot",
        capacite: createdRow.capacite ?? 0,
      });
      setSaving(false);
      return;
    }

    const currentId = selectedItem;
    if (currentId == null || currentId === "new") {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("emplacements")
      .update({
        nom: draft.nom.trim(),
        type: draft.type,
        capacite: draft.capacite,
      })
      .eq("id", currentId)
      .eq("organisation_id", orgId);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadData(orgId);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (orgId.length === 0) {
      return;
    }

    if (!confirm("Supprimer cet emplacement ?")) {
      return;
    }

    const { error } = await supabase.from("emplacements").delete().eq("id", id).eq("organisation_id", orgId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData(orgId);

    if (selectedItem === id) {
      setSelectedItem(null);
      setIsCreating(false);
      setDraft(initialDraft);
    }

    setActiveMenu(null);
  };

  return (
    <div style={splitLayout}>
      <section style={leftPane}>
        <div style={viewCard}>
          <header style={cardHeaderRow}>
            <div>
              <h2 style={cardTitle}>Emplacements</h2>
              <p style={cardSubtitle}>Gerez vos depots et zones de stockage.</p>
            </div>
            <button type="button" style={primaryButton} onClick={selectForCreate}>
              + Ajouter
            </button>
          </header>

          {loadingList ? (
            <p style={helperText}>Chargement des emplacements...</p>
          ) : emplacementList.length === 0 ? (
            <p style={helperText}>Aucun emplacement pour le moment.</p>
          ) : (
            <div style={itemStack}>
              {emplacementList.map((item) => {
                const isActive = selectedItem === item.id && !isCreating;

                return (
                  <article key={item.id} style={listItemStyle(isActive)}>
                    <button type="button" style={itemContentButton} onClick={() => selectForEdit(item)}>
                      <span style={itemTextWrap}>
                        <strong style={itemTitle}>{item.nom}</strong>
                        <span style={itemDescription}>Type: {formatTypeLabel(item.type)} • Capacite: {item.capacite ?? 0}</span>
                      </span>
                      <span style={typeBadge(item.type ?? "depot")}>{formatTypeLabel(item.type)}</span>
                    </button>

                    <div style={menuWrap}>
                      <button
                        type="button"
                        style={burgerButton}
                        onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                      >
                        ⋮
                      </button>

                      {activeMenu === item.id ? (
                        <div style={dropdownMenu}>
                          <button type="button" style={dropdownButton} onClick={() => selectForEdit(item)}>
                            Modifier
                          </button>
                          <button type="button" style={dropdownDangerButton} onClick={() => handleDelete(item.id)}>
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section style={rightPane}>
        <div style={viewCard}>
          {selectedItem == null ? (
            <div style={emptyState}>Selectionnez un item pour le modifier.</div>
          ) : (
            <form style={formWrap} onSubmit={handleSubmit}>
              <header style={formHeader}>
                <h3 style={formTitle}>{isCreating ? "Nouvel emplacement" : "Edition de l'emplacement"}</h3>
                {!isCreating ? <span style={chipInfo}>Mise a jour</span> : <span style={chipInfo}>Creation</span>}
              </header>

              <label style={fieldLabel} htmlFor="location-name">
                Nom
              </label>
              <input
                id="location-name"
                style={fieldInput}
                value={draft.nom}
                onChange={(event) => setDraft((current) => ({ ...current, nom: event.target.value }))}
                placeholder="Ex: Depot principal"
                required
              />

              <label style={fieldLabel} htmlFor="location-type">
                Type
              </label>
              <select
                id="location-type"
                style={fieldInput}
                value={draft.type}
                onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="depot">Depot</option>
                <option value="zone">Zone</option>
                <option value="rayon">Rayon</option>
              </select>

              <label style={fieldLabel} htmlFor="location-capacity">
                Capacite
              </label>
              <input
                id="location-capacity"
                style={fieldInput}
                type="number"
                min={0}
                value={draft.capacite}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, capacite: Number(event.target.value) || 0 }))
                }
                placeholder="0"
              />

              <div style={actionsRow}>
                <button type="button" style={ghostButton} onClick={() => setSelectedItem(null)}>
                  Annuler
                </button>
                <button type="submit" style={submitButton} disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function formatTypeLabel(value: string | null): string {
  if (value === "zone") return "Zone";
  if (value === "rayon") return "Rayon";
  return "Depot";
}

const splitLayout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "16px",
};

const leftPane: React.CSSProperties = {
  minWidth: 0,
};

const rightPane: React.CSSProperties = {
  minWidth: 0,
};

const viewCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 16px 32px -25px rgba(15, 23, 42, 0.28)",
};

const cardHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "18px",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 900,
  color: "#0f172a",
};

const cardSubtitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "0.82rem",
};

const primaryButton: React.CSSProperties = {
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const helperText: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.88rem",
  margin: 0,
};

const itemStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const listItemStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  border: active ? "1px solid #4338ca" : "1px solid #e2e8f0",
  borderRadius: "16px",
  background: active ? "#eef2ff" : "#f8fafc",
  padding: "8px 10px",
});

const itemContentButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
  width: "100%",
};

const itemTextWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
};

const itemTitle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 800,
  fontSize: "0.9rem",
};

const itemDescription: React.CSSProperties = {
  color: "#64748b",
  fontSize: "0.78rem",
};

const typeBadge = (type: string): React.CSSProperties => ({
  background: type === "depot" ? "#e0e7ff" : type === "zone" ? "#dcfce7" : "#fee2e2",
  color: type === "depot" ? "#3730a3" : type === "zone" ? "#166534" : "#9f1239",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 800,
  padding: "4px 10px",
  whiteSpace: "nowrap",
});

const menuWrap: React.CSSProperties = {
  position: "relative",
};

const burgerButton: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "10px",
  width: "34px",
  height: "34px",
  cursor: "pointer",
  color: "#334155",
  fontSize: "1rem",
  fontWeight: 800,
};

const dropdownMenu: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "38px",
  zIndex: 20,
  minWidth: "130px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.1)",
  padding: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const dropdownButton: React.CSSProperties = {
  border: "none",
  background: "#f8fafc",
  borderRadius: "8px",
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 800,
  fontSize: "0.78rem",
  cursor: "pointer",
  color: "#334155",
};

const dropdownDangerButton: React.CSSProperties = {
  border: "none",
  background: "#fef2f2",
  borderRadius: "8px",
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 800,
  fontSize: "0.78rem",
  cursor: "pointer",
  color: "#991b1b",
};

const emptyState: React.CSSProperties = {
  minHeight: "260px",
  border: "1px dashed #cbd5e1",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
  padding: "16px",
};

const formWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const formHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const formTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 900,
  color: "#0f172a",
};

const chipInfo: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  color: "#4338ca",
  background: "#e0e7ff",
  borderRadius: "999px",
  padding: "6px 10px",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 900,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginTop: "8px",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "0.9rem",
  color: "#0f172a",
  outline: "none",
  background: "#ffffff",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "16px",
};

const ghostButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: "12px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const submitButton: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};
