"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";

type LegacyRateId = "standard" | "reduit" | "super_reduit";
type SourceMode = "rates" | "legacy";

interface TaxRateRow {
  id: string;
  nom: string;
  taux: number;
  par_defaut: boolean;
}

interface TaxRateDraft {
  nom: string;
  taux: number;
  par_defaut: boolean;
}

interface LegacyConfigRow {
  taux_standard: number | null;
  taux_reduit: number | null;
  taux_super_reduit: number | null;
  taux_par_defaut?: string | null;
}

const initialDraft: TaxRateDraft = {
  nom: "",
  taux: 20,
  par_defaut: false,
};

export default function FiscalitePage() {
  const [orgId, setOrgId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("rates");
  const [rateList, setRateList] = useState<TaxRateRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [legacyConfig, setLegacyConfig] = useState<LegacyConfigRow | null>(null);
  const [legacyHasDefaultColumn, setLegacyHasDefaultColumn] = useState(false);
  const [draft, setDraft] = useState<TaxRateDraft>(initialDraft);

  const loadData = useCallback(async (id: string) => {
    setLoadingList(true);

    const ratesResponse = await supabase
      .from("tva_rates")
      .select("id, nom, taux, par_defaut")
      .eq("organisation_id", id)
      .order("nom", { ascending: true });

    if (ratesResponse.error == null) {
      const rows = (ratesResponse.data ?? []) as Array<{
        id: string;
        nom: string;
        taux: number | null;
        par_defaut: boolean | null;
      }>;

      setSourceMode("rates");
      setLegacyConfig(null);
      setRateList(
        rows.map((row) => ({
          id: row.id,
          nom: row.nom,
          taux: Number(row.taux ?? 0),
          par_defaut: row.par_defaut === true,
        })),
      );
      setLoadingList(false);
      return;
    }

    const legacyResponse = await supabase
      .from("tva_config")
      .select("*")
      .eq("organisation_id", id)
      .maybeSingle();

    if (legacyResponse.error != null) {
      alert(legacyResponse.error.message);
      setRateList([]);
      setLoadingList(false);
      return;
    }

    const rawLegacy = (legacyResponse.data ?? {
      taux_standard: 20,
      taux_reduit: 10,
      taux_super_reduit: 5.5,
      taux_par_defaut: "standard",
    }) as LegacyConfigRow;

    const defaultRate: LegacyRateId =
      rawLegacy.taux_par_defaut === "reduit" || rawLegacy.taux_par_defaut === "super_reduit"
        ? (rawLegacy.taux_par_defaut as LegacyRateId)
        : "standard";

    setSourceMode("legacy");
    setLegacyConfig(rawLegacy);
    setLegacyHasDefaultColumn(Object.prototype.hasOwnProperty.call(rawLegacy, "taux_par_defaut"));
    setRateList([
      {
        id: "standard",
        nom: "TVA Standard",
        taux: Number(rawLegacy.taux_standard ?? 20),
        par_defaut: defaultRate === "standard",
      },
      {
        id: "reduit",
        nom: "TVA Reduit",
        taux: Number(rawLegacy.taux_reduit ?? 10),
        par_defaut: defaultRate === "reduit",
      },
      {
        id: "super_reduit",
        nom: "TVA Super Reduit",
        taux: Number(rawLegacy.taux_super_reduit ?? 5.5),
        par_defaut: defaultRate === "super_reduit",
      },
    ]);

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

  const selectForEdit = (item: TaxRateRow) => {
    setSelectedItem(item.id);
    setIsCreating(false);
    setDraft({
      nom: item.nom,
      taux: item.taux,
      par_defaut: item.par_defaut,
    });
    setActiveMenu(null);
  };

  const selectForCreate = () => {
    setSelectedItem("new");
    setIsCreating(true);
    setDraft(initialDraft);
    setActiveMenu(null);
  };

  const setAsDefault = (item: TaxRateRow) => {
    setSelectedItem(item.id);
    setIsCreating(false);
    setDraft({
      nom: item.nom,
      taux: item.taux,
      par_defaut: true,
    });
    setActiveMenu(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (orgId.length === 0) {
      alert("Organisation introuvable.");
      return;
    }

    if (draft.nom.trim().length === 0) {
      alert("Le nom du taux est obligatoire.");
      return;
    }

    setSaving(true);

    if (sourceMode === "rates") {
      if (isCreating) {
        const createResponse = await supabase
          .from("tva_rates")
          .insert([
            {
              organisation_id: orgId,
              nom: draft.nom.trim(),
              taux: draft.taux,
              par_defaut: draft.par_defaut,
            },
          ])
          .select("id")
          .single();

        if (createResponse.error != null) {
          alert(createResponse.error.message);
          setSaving(false);
          return;
        }

        if (draft.par_defaut === true) {
          const createdId = (createResponse.data as { id: string }).id;
          const resetResponse = await supabase
            .from("tva_rates")
            .update({ par_defaut: false })
            .eq("organisation_id", orgId)
            .neq("id", createdId);

          if (resetResponse.error != null) {
            alert(resetResponse.error.message);
            setSaving(false);
            return;
          }
        }

        await loadData(orgId);
        setSaving(false);
        return;
      }

      const currentId = selectedItem;
      if (currentId == null || currentId === "new") {
        setSaving(false);
        return;
      }

      const updateResponse = await supabase
        .from("tva_rates")
        .update({
          nom: draft.nom.trim(),
          taux: draft.taux,
          par_defaut: draft.par_defaut,
        })
        .eq("id", currentId)
        .eq("organisation_id", orgId);

      if (updateResponse.error != null) {
        alert(updateResponse.error.message);
        setSaving(false);
        return;
      }

      if (draft.par_defaut === true) {
        const resetResponse = await supabase
          .from("tva_rates")
          .update({ par_defaut: false })
          .eq("organisation_id", orgId)
          .neq("id", currentId);

        if (resetResponse.error != null) {
          alert(resetResponse.error.message);
          setSaving(false);
          return;
        }
      }

      await loadData(orgId);
      setSaving(false);
      return;
    }

    if (isCreating) {
      alert("Ajout indisponible en mode compatibilite. Creez la table tva_rates pour ajouter des taux.");
      setSaving(false);
      return;
    }

    const currentId = selectedItem as LegacyRateId | null;
    if (currentId == null) {
      setSaving(false);
      return;
    }

    const currentConfig = legacyConfig ?? {
      taux_standard: 20,
      taux_reduit: 10,
      taux_super_reduit: 5.5,
      taux_par_defaut: "standard",
    };

    const nextPayload: Record<string, unknown> = {
      organisation_id: orgId,
      taux_standard: currentId === "standard" ? draft.taux : Number(currentConfig.taux_standard ?? 20),
      taux_reduit: currentId === "reduit" ? draft.taux : Number(currentConfig.taux_reduit ?? 10),
      taux_super_reduit:
        currentId === "super_reduit" ? draft.taux : Number(currentConfig.taux_super_reduit ?? 5.5),
    };

    if (legacyHasDefaultColumn === true) {
      nextPayload.taux_par_defaut = draft.par_defaut === true ? currentId : currentConfig.taux_par_defaut ?? "standard";
    }

    const legacyUpsert = await supabase.from("tva_config").upsert(nextPayload, { onConflict: "organisation_id" });

    if (legacyUpsert.error != null) {
      alert(legacyUpsert.error.message);
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

    if (sourceMode === "legacy") {
      alert("Suppression indisponible en mode compatibilite tva_config.");
      return;
    }

    const confirmed = confirm("Supprimer ce taux de TVA ?");
    if (confirmed === false) {
      return;
    }

    const deleteResponse = await supabase.from("tva_rates").delete().eq("id", id).eq("organisation_id", orgId);

    if (deleteResponse.error != null) {
      alert(deleteResponse.error.message);
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
              <h2 style={cardTitle}>Fiscalite</h2>
              <p style={cardSubtitle}>Liste des taux de TVA et actions rapides.</p>
            </div>
            <button type="button" style={primaryButton} onClick={selectForCreate}>
              + Ajouter
            </button>
          </header>

          <p style={modeBadge(sourceMode)}>
            {sourceMode === "rates"
              ? "Mode standard tva_rates"
              : "Mode compatibilite tva_config (edition uniquement)"}
          </p>

          {loadingList ? (
            <p style={helperText}>Chargement des taux de TVA...</p>
          ) : rateList.length === 0 ? (
            <p style={helperText}>Aucun taux disponible.</p>
          ) : (
            <div style={itemStack}>
              {rateList.map((item) => {
                const isActive = selectedItem === item.id && isCreating === false;

                return (
                  <article key={item.id} style={listItemStyle(isActive)}>
                    <button type="button" style={itemContentButton} onClick={() => selectForEdit(item)}>
                      <span style={itemTextWrap}>
                        <strong style={itemTitle}>{item.nom}</strong>
                        <span style={itemDescription}>{item.taux.toFixed(2)} %</span>
                      </span>
                      {item.par_defaut ? <span style={defaultBadge}>Par defaut</span> : null}
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
                          <button type="button" style={dropdownButton} onClick={() => setAsDefault(item)}>
                            Definir par defaut
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
                <h3 style={formTitle}>{isCreating ? "Nouveau taux de TVA" : "Edition du taux de TVA"}</h3>
                {isCreating ? <span style={chipInfo}>Creation</span> : <span style={chipInfo}>Mise a jour</span>}
              </header>

              <label style={fieldLabel} htmlFor="tax-name">
                Nom
              </label>
              <input
                id="tax-name"
                style={fieldInput}
                value={draft.nom}
                onChange={(event) => setDraft((current) => ({ ...current, nom: event.target.value }))}
                placeholder="Ex: TVA Export"
                required
              />

              <label style={fieldLabel} htmlFor="tax-rate">
                Taux %
              </label>
              <input
                id="tax-rate"
                style={fieldInput}
                type="number"
                min={0}
                step="0.01"
                value={draft.taux}
                onChange={(event) => setDraft((current) => ({ ...current, taux: Number(event.target.value) || 0 }))}
              />

              <label style={fieldLabel} htmlFor="tax-default">
                Par defaut
              </label>
              <select
                id="tax-default"
                style={fieldInput}
                value={draft.par_defaut ? "oui" : "non"}
                onChange={(event) => setDraft((current) => ({ ...current, par_defaut: event.target.value === "oui" }))}
              >
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>

              {sourceMode === "legacy" && isCreating ? (
                <p style={warningText}>Ajout indisponible en mode compatibilite tva_config.</p>
              ) : null}

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
  marginBottom: "14px",
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

const modeBadge = (mode: SourceMode): React.CSSProperties => ({
  margin: "0 0 12px",
  fontSize: "0.74rem",
  fontWeight: 800,
  color: mode === "rates" ? "#3730a3" : "#7c2d12",
  background: mode === "rates" ? "#e0e7ff" : "#ffedd5",
  display: "inline-block",
  borderRadius: "999px",
  padding: "6px 10px",
});

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

const defaultBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 800,
  padding: "4px 10px",
  whiteSpace: "nowrap",
};

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
  minWidth: "160px",
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

const warningText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#b45309",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "10px",
  fontSize: "0.78rem",
  fontWeight: 800,
  padding: "10px",
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
