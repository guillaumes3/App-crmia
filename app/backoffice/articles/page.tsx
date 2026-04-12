"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import StockBulkImport, { type ImportSummary } from "./components/StockBulkImport";
import StockStatusBadge from "./components/StockStatusBadge";
import { getAccessLevel } from "@/app/utils/authGuard";
import { supabase } from "@/utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";

interface ArticleRow {
  id: string;
  nom: string;
  quantite_actuelle: number;
  seuil_alerte: number;
  organisation_id: string;
}

type RightPaneMode = "details" | "create";

export default function ArticlesPage() {
  const [organisationId, setOrganisationId] = useState<string>("");
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [menuArticleId, setMenuArticleId] = useState<string | null>(null);
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("details");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("0");
  const [editThreshold, setEditThreshold] = useState("0");
  const [createName, setCreateName] = useState("");
  const [createQuantity, setCreateQuantity] = useState("0");
  const [createThreshold, setCreateThreshold] = useState("0");

  const [savingEdit, setSavingEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const userRole = "Gestionnaire Stock";
  const access = getAccessLevel(userRole, "articles");
  const readOnly = access === "read";

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => {
      window.removeEventListener("resize", syncLayout);
    };
  }, []);

  const loadArticles = useCallback(async (orgId: string) => {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("organisation_id", orgId)
      .order("nom", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = mapArticleRows(data);
    setArticles(rows);
    setSelectedArticleId((current) => {
      if (current && rows.some((row) => row.id === current)) {
        return current;
      }
      return rows[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setLoadingError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Session utilisateur introuvable.");
        }

        if (isKipiloteStaff(session.user)) {
          setActiveUniverse("hq");
          throw new Error("Acces staff HQ interdit sur le stock client.");
        }

        setActiveUniverse("client");
        const orgId = getOrganisationId(session.user);
        if (!orgId) {
          throw new Error("organisation_id manquant dans la session.");
        }

        if (!isMounted) {
          return;
        }

        setOrganisationId(orgId);
        await loadArticles(orgId);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadingError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [loadArticles]);

  const filteredArticles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesSearch = normalizedSearch.length === 0 || article.nom.toLowerCase().includes(normalizedSearch);
      const matchesLowFilter = !showLowOnly || article.quantite_actuelle <= article.seuil_alerte;
      return matchesSearch && matchesLowFilter;
    });
  }, [articles, search, showLowOnly]);

  const selectedArticle = useMemo(() => {
    return filteredArticles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0] ?? null;
  }, [filteredArticles, selectedArticleId]);

  const lowStockCount = useMemo(() => {
    return articles.filter((article) => article.quantite_actuelle <= article.seuil_alerte).length;
  }, [articles]);

  useEffect(() => {
    if (!selectedArticle || rightPaneMode === "create") {
      return;
    }

    setEditName(selectedArticle.nom);
    setEditQuantity(String(selectedArticle.quantite_actuelle));
    setEditThreshold(String(selectedArticle.seuil_alerte));
  }, [rightPaneMode, selectedArticle]);

  const handleImportComplete = useCallback(
    (summary: ImportSummary) => {
      setLastImportSummary(summary);
      setIsImportModalOpen(false);
      setInfoMessage("Import CSV termine avec succes.");
      setActionError(null);
      if (organisationId) {
        void loadArticles(organisationId);
      }
    },
    [loadArticles, organisationId],
  );

  const handleExportCsv = useCallback(async () => {
    if (!organisationId) {
      setExportError("Organisation introuvable pour l'export CSV.");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      let rowsToExport = articles;

      if (rowsToExport.length === 0) {
        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .eq("organisation_id", organisationId)
          .order("nom", { ascending: true });

        if (error) {
          throw new Error(error.message);
        }

        rowsToExport = mapArticleRows(data);
      }

      if (rowsToExport.length === 0) {
        throw new Error("Aucun article a exporter pour cette organisation.");
      }

      const header = ["id", "nom", "quantite_actuelle", "seuil_alerte"];
      const lines = rowsToExport.map((article) => {
        return [article.id, article.nom, String(article.quantite_actuelle), String(article.seuil_alerte)]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(",");
      });

      const csv = [header.join(","), ...lines].join("\n");
      downloadCsv(csv, "stock_articles.csv");
      setInfoMessage("Export CSV genere.");
    } catch (error) {
      setExportError(getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }, [articles, organisationId]);

  const openArticleDetails = (article: ArticleRow) => {
    setSelectedArticleId(article.id);
    setRightPaneMode("details");
    setMenuArticleId(null);
    setActionError(null);
  };

  const handleSaveSelectedArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly || !organisationId || !selectedArticle) {
      return;
    }

    setSavingEdit(true);
    setActionError(null);

    const payload = {
      nom: editName.trim(),
      quantite_actuelle: Math.max(0, toNumber(editQuantity)),
      seuil_alerte: Math.max(0, toNumber(editThreshold)),
    };

    if (payload.nom.length === 0) {
      setSavingEdit(false);
      setActionError("Le nom de l'article est obligatoire.");
      return;
    }

    const { error } = await supabase
      .from("articles")
      .update(payload)
      .eq("id", selectedArticle.id)
      .eq("organisation_id", organisationId);

    if (error) {
      setSavingEdit(false);
      setActionError(error.message);
      return;
    }

    await loadArticles(organisationId);
    setInfoMessage("Article mis a jour.");
    setSavingEdit(false);
  };

  const handleCreateArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly || !organisationId) {
      return;
    }

    const name = createName.trim();
    if (!name) {
      setActionError("Le nom de l'article est obligatoire.");
      return;
    }

    setCreating(true);
    setActionError(null);

    const { error } = await supabase.from("articles").insert([
      {
        organisation_id: organisationId,
        nom: name,
        quantite_actuelle: Math.max(0, toNumber(createQuantity)),
        seuil_alerte: Math.max(0, toNumber(createThreshold)),
      },
    ]);

    if (error) {
      setCreating(false);
      setActionError(error.message);
      return;
    }

    setCreateName("");
    setCreateQuantity("0");
    setCreateThreshold("0");
    await loadArticles(organisationId);
    setInfoMessage("Article cree.");
    setCreating(false);
    setRightPaneMode("details");
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (readOnly || !organisationId) {
      return;
    }

    const confirmed = confirm("Supprimer cet article ?");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("articles").delete().eq("id", articleId).eq("organisation_id", organisationId);
    if (error) {
      setActionError(error.message);
      return;
    }

    setMenuArticleId(null);
    setInfoMessage("Article supprime.");
    setActionError(null);
    await loadArticles(organisationId);
  };

  if (loading) {
    return <section style={feedbackCardStyle}>Chargement des articles...</section>;
  }

  if (loadingError) {
    return <section style={{ ...feedbackCardStyle, ...errorCardStyle }}>Erreur: {loadingError}</section>;
  }

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>
            Stock
            {readOnly ? <span style={readOnlyBadgeStyle}>Lecture seule</span> : null}
          </h1>
          <p style={pageSubtitleStyle}>Suivi des niveaux, edition des fiches et import CSV par organisation.</p>
        </div>

        <div style={headerActionsStyle}>
          <button
            type="button"
            onClick={() => setShowLowOnly((current) => !current)}
            style={{
              ...secondaryButtonStyle,
              ...(showLowOnly ? secondaryButtonActiveStyle : {}),
            }}
          >
            Filtres
          </button>
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={!organisationId || isExporting}
            style={{ ...secondaryButtonStyle, ...(!organisationId || isExporting ? disabledControlStyle : {}) }}
          >
            {isExporting ? "Export..." : "Export"}
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            disabled={readOnly}
            style={{ ...primaryButtonStyle, ...(readOnly ? disabledControlStyle : {}) }}
          >
            Import
          </button>
        </div>
      </header>

      {lastImportSummary ? (
        <div style={successBannerStyle}>
          Import termine: {lastImportSummary.total} lignes traitees ({lastImportSummary.created} creees, {lastImportSummary.updated} mises a jour).
        </div>
      ) : null}
      {infoMessage ? <div style={successBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={warningBannerStyle}>{actionError}</div> : null}
      {exportError ? <div style={warningBannerStyle}>{exportError}</div> : null}

      <StockBulkImport
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        organisationId={organisationId}
        disabled={readOnly}
        onImportComplete={handleImportComplete}
      />

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={leftPaneStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardHeadingWrapStyle}>
              <h2 style={cardTitleStyle}>Articles</h2>
              <span style={countBadgeStyle}>{filteredArticles.length}</span>
            </div>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => {
                setRightPaneMode("create");
                setMenuArticleId(null);
              }}
              style={{ ...smallPrimaryButtonStyle, ...(readOnly ? disabledControlStyle : {}) }}
            >
              + Ajouter
            </button>
          </div>

          <input
            type="search"
            placeholder="Rechercher un article"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={searchInputStyle}
          />

          <div style={subtleKpiWrapStyle}>
            <div style={subtleKpiStyle}>
              <span style={subtleKpiLabelStyle}>Stock bas / rupture</span>
              <strong style={subtleKpiValueStyle}>{lowStockCount}</strong>
            </div>
          </div>

          <div style={listWrapStyle}>
            {filteredArticles.length === 0 ? (
              <div style={emptyStateStyle}>Aucun article sur cette selection.</div>
            ) : (
              filteredArticles.map((article) => {
                const isSelected = article.id === selectedArticle?.id;

                return (
                  <article key={article.id} style={getListItemStyle(isSelected)}>
                    <button type="button" style={itemContentButtonStyle} onClick={() => openArticleDetails(article)}>
                      <strong style={itemTitleStyle}>{article.nom}</strong>
                      <span style={itemMetaStyle}>
                        {article.quantite_actuelle} unites • Seuil {article.seuil_alerte}
                      </span>
                    </button>

                    <div style={itemRightWrapStyle}>
                      <StockStatusBadge quantite={article.quantite_actuelle} seuil={article.seuil_alerte} />
                      <div style={menuWrapStyle}>
                        <button
                          type="button"
                          style={menuButtonStyle}
                          onClick={() => setMenuArticleId((current) => (current === article.id ? null : article.id))}
                        >
                          ⋮
                        </button>
                        {menuArticleId === article.id ? (
                          <div style={menuPopoverStyle}>
                            <button type="button" style={menuActionStyle} onClick={() => openArticleDetails(article)}>
                              Details
                            </button>
                            <button
                              type="button"
                              style={menuActionStyle}
                              onClick={() => {
                                openArticleDetails(article);
                                setRightPaneMode("details");
                              }}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              style={menuDangerActionStyle}
                              disabled={readOnly}
                              onClick={() => void handleDeleteArticle(article.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section style={rightPaneStyle}>
          {rightPaneMode === "create" ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <h2 style={detailTitleStyle}>Nouveau produit</h2>
                <span style={modeTagStyle}>Creation</span>
              </div>

              <form style={formStyle} onSubmit={handleCreateArticle}>
                <label style={fieldLabelStyle} htmlFor="new-name">
                  Nom
                </label>
                <input
                  id="new-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Ex: Batterie externe"
                  style={fieldInputStyle}
                  required
                />

                <label style={fieldLabelStyle} htmlFor="new-qty">
                  Quantite
                </label>
                <input
                  id="new-qty"
                  type="number"
                  min={0}
                  value={createQuantity}
                  onChange={(event) => setCreateQuantity(event.target.value)}
                  style={fieldInputStyle}
                />

                <label style={fieldLabelStyle} htmlFor="new-threshold">
                  Seuil alerte
                </label>
                <input
                  id="new-threshold"
                  type="number"
                  min={0}
                  value={createThreshold}
                  onChange={(event) => setCreateThreshold(event.target.value)}
                  style={fieldInputStyle}
                />

                <div style={formActionsStyle}>
                  <button type="button" style={secondaryButtonStyle} onClick={() => setRightPaneMode("details")}>
                    Annuler
                  </button>
                  <button type="submit" style={primaryButtonStyle} disabled={creating || readOnly}>
                    {creating ? "Creation..." : "Creer"}
                  </button>
                </div>
              </form>
            </article>
          ) : selectedArticle ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <h2 style={detailTitleStyle}>{selectedArticle.nom}</h2>
                  <p style={detailSubtitleStyle}>Fiche article et edition rapide</p>
                </div>
                <span style={modeTagStyle}>Edition</span>
              </div>

              <div style={detailKpiGridStyle}>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Quantite</span>
                  <strong style={detailKpiValueStyle}>{selectedArticle.quantite_actuelle}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Seuil</span>
                  <strong style={detailKpiValueStyle}>{selectedArticle.seuil_alerte}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Statut</span>
                  <div style={detailBadgeWrapStyle}>
                    <StockStatusBadge quantite={selectedArticle.quantite_actuelle} seuil={selectedArticle.seuil_alerte} />
                  </div>
                </div>
              </div>

              <form style={formStyle} onSubmit={handleSaveSelectedArticle}>
                <label style={fieldLabelStyle} htmlFor="edit-name">
                  Nom
                </label>
                <input
                  id="edit-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  style={fieldInputStyle}
                  required
                />

                <label style={fieldLabelStyle} htmlFor="edit-quantity">
                  Quantite actuelle
                </label>
                <input
                  id="edit-quantity"
                  type="number"
                  min={0}
                  value={editQuantity}
                  onChange={(event) => setEditQuantity(event.target.value)}
                  style={fieldInputStyle}
                />

                <label style={fieldLabelStyle} htmlFor="edit-threshold">
                  Seuil alerte
                </label>
                <input
                  id="edit-threshold"
                  type="number"
                  min={0}
                  value={editThreshold}
                  onChange={(event) => setEditThreshold(event.target.value)}
                  style={fieldInputStyle}
                />

                <div style={formActionsStyle}>
                  <button type="submit" style={primaryButtonStyle} disabled={savingEdit || readOnly}>
                    {savingEdit ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            </article>
          ) : (
            <div style={emptyStateStyle}>Selectionnez un article a gauche.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue.";
}

function mapArticleRows(data: unknown): ArticleRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const source = item as Record<string, unknown>;
    const id = source.id;
    const nom = source.nom;
    const organisationId = source.organisation_id;

    if (typeof id !== "string" || typeof nom !== "string" || typeof organisationId !== "string") {
      return [];
    }

    const quantite = toNumber(source.quantite_actuelle ?? source.stock ?? source.quantite ?? 0);
    const seuil = toNumber(source.seuil_alerte ?? source.seuil ?? source.min_stock ?? 0);

    return [
      {
        id,
        nom,
        organisation_id: organisationId,
        quantite_actuelle: quantite,
        seuil_alerte: seuil,
      },
    ];
  });
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

const palette = {
  pageBg: "#f8fafc",
  white: "#ffffff",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  indigoSoft: "#e0e7ff",
  indigoMain: "#4338ca",
  indigoDark: "#312e81",
  mintSoft: "#d1fae5",
  mintText: "#065f46",
  salmonSoft: "#ffe4e6",
  salmonText: "#9f1239",
};

const cardShadow = "0 16px 32px -25px rgba(15, 23, 42, 0.28)";
const actionGradient = "linear-gradient(135deg, #4338ca 0%, #312e81 100%)";

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  color: palette.slate900,
};

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.52rem",
  fontWeight: 900,
  display: "flex",
  gap: "8px",
  alignItems: "center",
  color: palette.white,
};

const readOnlyBadgeStyle: React.CSSProperties = {
  background: "rgba(226,232,240,0.16)",
  color: palette.white,
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "0.92rem",
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: actionGradient,
  color: palette.white,
  borderRadius: "12px",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "0.84rem",
  boxShadow: "0 10px 20px -14px rgba(49, 46, 129, 0.9)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.35)",
  background: "rgba(255,255,255,0.08)",
  color: palette.white,
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "0.85rem",
  backdropFilter: "blur(4px)",
};

const secondaryButtonActiveStyle: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.52)",
  background: "rgba(255,255,255,0.18)",
  color: palette.white,
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: actionGradient,
  color: palette.white,
  borderRadius: "12px",
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "0.8rem",
  boxShadow: "0 10px 20px -14px rgba(49, 46, 129, 0.9)",
};

const disabledControlStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const successBannerStyle: React.CSSProperties = {
  background: palette.mintSoft,
  color: palette.mintText,
  border: "1px solid #a7f3d0",
  borderRadius: "20px",
  padding: "10px 12px",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const warningBannerStyle: React.CSSProperties = {
  background: palette.salmonSoft,
  color: palette.salmonText,
  border: "1px solid #fecdd3",
  borderRadius: "20px",
  padding: "10px 12px",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const feedbackCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "18px",
  color: palette.slate500,
  fontWeight: 700,
  boxShadow: cardShadow,
};

const errorCardStyle: React.CSSProperties = {
  color: palette.salmonText,
  background: palette.salmonSoft,
};

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
  alignItems: "stretch",
});

const leftPaneStyle: React.CSSProperties = {
  minWidth: 0,
  background: palette.white,
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: cardShadow,
};

const rightPaneStyle: React.CSSProperties = {
  minWidth: 0,
  background: palette.white,
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: cardShadow,
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const cardHeadingWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: "1.04rem",
};

const countBadgeStyle: React.CSSProperties = {
  minWidth: "28px",
  height: "28px",
  borderRadius: "14px",
  background: palette.indigoSoft,
  color: palette.indigoDark,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  fontWeight: 800,
  fontSize: "0.78rem",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${palette.slate300}`,
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "0.88rem",
  outline: "none",
  color: palette.slate900,
};

const subtleKpiWrapStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  background: "#f8fafc",
  padding: "12px",
};

const subtleKpiStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const subtleKpiLabelStyle: React.CSSProperties = {
  color: palette.slate500,
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const subtleKpiValueStyle: React.CSSProperties = {
  color: palette.slate900,
  fontSize: "1.03rem",
  fontWeight: 900,
};

const listWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxHeight: "620px",
  overflowY: "auto",
  paddingRight: "2px",
};

const getListItemStyle = (selected: boolean): React.CSSProperties => ({
  border: selected ? `1px solid ${palette.indigoMain}` : `1px solid ${palette.slate200}`,
  background: selected ? "#eef2ff" : palette.white,
  borderRadius: "16px",
  padding: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  boxShadow: selected ? "0 12px 24px -20px rgba(67,56,202,0.55)" : "none",
});

const itemContentButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
  minWidth: 0,
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 900,
  color: palette.slate900,
};

const itemMetaStyle: React.CSSProperties = {
  fontSize: "0.79rem",
  color: palette.slate500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "220px",
};

const itemRightWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

const menuWrapStyle: React.CSSProperties = {
  position: "relative",
};

const menuButtonStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  border: `1px solid ${palette.slate200}`,
  background: "#f8fafc",
  color: palette.slate700,
  fontWeight: 800,
  cursor: "pointer",
};

const menuPopoverStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "38px",
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: "140px",
  border: `1px solid ${palette.slate200}`,
  borderRadius: "12px",
  background: palette.white,
  padding: "6px",
  boxShadow: cardShadow,
};

const menuActionStyle: React.CSSProperties = {
  border: "none",
  background: "#f8fafc",
  color: palette.slate700,
  borderRadius: "10px",
  padding: "8px 10px",
  textAlign: "left",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
};

const menuDangerActionStyle: React.CSSProperties = {
  border: "none",
  background: palette.salmonSoft,
  color: palette.salmonText,
  borderRadius: "10px",
  padding: "8px 10px",
  textAlign: "left",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
};

const detailCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: cardShadow,
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const detailTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.18rem",
  fontWeight: 900,
  color: palette.slate900,
};

const detailSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: palette.slate500,
  fontSize: "0.85rem",
};

const modeTagStyle: React.CSSProperties = {
  background: palette.indigoSoft,
  color: palette.indigoDark,
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: 800,
  fontSize: "0.73rem",
};

const detailKpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "14px",
};

const detailKpiCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  background: palette.white,
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const detailKpiLabelStyle: React.CSSProperties = {
  color: palette.slate500,
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const detailKpiValueStyle: React.CSSProperties = {
  color: palette.slate900,
  fontSize: "1rem",
  fontWeight: 900,
};

const detailBadgeWrapStyle: React.CSSProperties = {
  marginTop: "2px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  color: palette.slate500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const fieldInputStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate300}`,
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "0.88rem",
  color: palette.slate900,
  background: palette.white,
  outline: "none",
};

const formActionsStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const emptyStateStyle: React.CSSProperties = {
  minHeight: "180px",
  border: `1px dashed ${palette.slate300}`,
  borderRadius: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: palette.slate500,
  fontWeight: 700,
  fontSize: "0.88rem",
  padding: "14px",
  background: "#f8fafc",
};
