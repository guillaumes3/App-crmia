"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";

type CommandeStatus = "Toutes" | "Brouillon" | "Validee" | "Expediee" | "Livree" | "Annulee";
type CommandeItemStatus = Exclude<CommandeStatus, "Toutes">;

type CommandeRow = {
  id: string;
  reference: string;
  statut: CommandeItemStatus;
  clientNom: string;
  totalTtc: number;
  dateCommande: string;
};

const statusOptions: CommandeStatus[] = ["Toutes", "Brouillon", "Validee", "Expediee", "Livree", "Annulee"];
const euroFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function CommandesPage() {
  const [organisationId, setOrganisationId] = useState("");
  const [rows, setRows] = useState<CommandeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CommandeStatus>("Toutes");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const syncLayout = () => setIsCompact(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      setLoadingError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Session utilisateur introuvable.");
        const orgId = session.user.user_metadata?.organisation_id as string | undefined;
        if (!orgId) throw new Error("organisation_id manquant dans la session.");

        const { data, error } = await supabase
          .from("commandes")
          .select("*")
          .eq("organisation_id", orgId)
          .order("updated_at", { ascending: false });
        if (error) throw error;

        const mapped = mapRows(Array.isArray(data) ? data : []);
        if (!mounted) return;
        setOrganisationId(orgId);
        setRows(mapped);
        setSelectedId(mapped[0]?.id ?? null);
      } catch (error) {
        if (mounted) setLoadingError(getErrorMessage(error));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const statusMatch = statusFilter === "Toutes" || row.statut === statusFilter;
      const searchMatch =
        q.length === 0 ||
        row.reference.toLowerCase().includes(q) ||
        row.clientNom.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q);
      return statusMatch && searchMatch;
    });
  }, [rows, search, statusFilter]);

  const selected = useMemo(() => {
    return filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  }, [filteredRows, selectedId]);

  const totalAmount = useMemo(() => filteredRows.reduce((sum, row) => sum + row.totalTtc, 0), [filteredRows]);

  const handleExport = () => {
    if (filteredRows.length === 0) return;
    const header = ["id", "reference", "client_nom", "statut", "date_commande", "total_ttc"];
    const lines = filteredRows.map((row) =>
      [row.id, row.reference, row.clientNom, row.statut, row.dateCommande, String(row.totalTtc)]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "commandes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (!organisationId) return;
    const confirmed = confirm("Supprimer cette commande ?");
    if (!confirmed) return;
    const { error } = await supabase.from("commandes").delete().eq("id", id).eq("organisation_id", organisationId);
    if (error) {
      setActionError(error.message);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setMenuId(null);
    setInfoMessage("Commande supprimee.");
  };

  if (loading) return <section style={feedbackCardStyle}>Chargement des commandes...</section>;
  if (loadingError) return <section style={{ ...feedbackCardStyle, ...warningBannerStyle }}>Erreur: {loadingError}</section>;

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Commandes</h1>
          <p style={pageSubtitleStyle}>Suivi des expeditions et des livraisons en temps reel.</p>
        </div>
        <div style={headerActionsStyle}>
          <button type="button" style={{ ...secondaryButtonStyle, ...(showFilters ? secondaryButtonActiveStyle : {}) }} onClick={() => setShowFilters((v) => !v)}>
            Filtres
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleExport}>
            Export
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => setInfoMessage("Creation de commande via le flux de vente.")}>
            Import / Ajouter
          </button>
        </div>
      </header>

      {infoMessage ? <div style={successBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={warningBannerStyle}>{actionError}</div> : null}

      <div style={summaryCardStyle}>
        <span style={summaryLabelStyle}>Montant commandes filtres</span>
        <strong style={summaryValueStyle}>{euroFormat.format(totalAmount)}</strong>
      </div>

      <div style={getDualPaneStyle(isCompact)}>
        <section style={leftPaneStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardHeadingWrapStyle}>
              <h2 style={cardTitleStyle}>Liste des commandes</h2>
              <span style={countBadgeStyle}>{filteredRows.length}</span>
            </div>
            <button type="button" style={smallPrimaryButtonStyle} onClick={() => setInfoMessage("Ajout manuel indisponible sur cet ecran.")}>
              + Ajouter
            </button>
          </div>

          {showFilters ? (
            <div style={filtersCardStyle}>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, client, id" style={fieldInputStyle} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CommandeStatus)} style={fieldInputStyle}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div style={listWrapStyle}>
            {filteredRows.length === 0 ? (
              <div style={emptyStateStyle}>Aucune commande pour cette selection.</div>
            ) : (
              filteredRows.map((row) => (
                <article key={row.id} style={getListItemStyle(row.id === selected?.id)}>
                  <button type="button" style={itemContentButtonStyle} onClick={() => setSelectedId(row.id)}>
                    <strong style={itemTitleStyle}>{row.reference}</strong>
                    <span style={itemMetaStyle}>{row.clientNom}</span>
                    <span style={itemMetaStyle}>{formatDate(row.dateCommande)}</span>
                  </button>
                  <div style={itemRightWrapStyle}>
                    <span style={getStatusBadgeStyle(row.statut)}>{row.statut}</span>
                    <div style={menuWrapStyle}>
                      <button type="button" style={menuButtonStyle} onClick={() => setMenuId((current) => (current === row.id ? null : row.id))}>
                        ⋮
                      </button>
                      {menuId === row.id ? (
                        <div style={menuPopoverStyle}>
                          <button type="button" style={menuActionStyle} onClick={() => setSelectedId(row.id)}>
                            Details
                          </button>
                          <button type="button" style={menuActionStyle} onClick={() => setInfoMessage("Edition disponible sur la fiche commande dediee.")}>
                            Modifier
                          </button>
                          <button type="button" style={menuDangerActionStyle} onClick={() => void handleDelete(row.id)}>
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section style={rightPaneStyle}>
          {selected ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <h2 style={detailTitleStyle}>{selected.reference}</h2>
                  <p style={detailSubtitleStyle}>Client: {selected.clientNom}</p>
                </div>
                <span style={getStatusBadgeStyle(selected.statut)}>{selected.statut}</span>
              </div>

              <div style={detailKpiGridStyle}>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Date commande</span>
                  <strong style={detailKpiValueStyle}>{formatDate(selected.dateCommande)}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Montant TTC</span>
                  <strong style={detailKpiValueStyle}>{euroFormat.format(selected.totalTtc)}</strong>
                </div>
              </div>
            </article>
          ) : (
            <div style={emptyStateStyle}>Selectionnez une commande a gauche.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function mapRows(data: unknown[]): CommandeRow[] {
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) return [];
    const rawStatus = typeof row.statut === "string" ? row.statut : typeof row.status === "string" ? row.status : "Validee";
    return [
      {
        id,
        reference: typeof row.reference === "string" ? row.reference : `CMD-${id.slice(0, 8).toUpperCase()}`,
        statut: normalizeStatus(rawStatus),
        clientNom: typeof row.client_nom === "string" ? row.client_nom : "Client non renseigne",
        totalTtc: toNumber(row.total_ttc ?? row.total ?? row.montant_ttc),
        dateCommande: typeof row.date_commande === "string" ? row.date_commande : new Date().toISOString(),
      },
    ];
  });
}

function normalizeStatus(value: string): CommandeItemStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("draft") || normalized.includes("brouillon")) return "Brouillon";
  if (normalized.includes("exped") || normalized.includes("ship")) return "Expediee";
  if (normalized.includes("livr") || normalized.includes("deliver")) return "Livree";
  if (normalized.includes("annul") || normalized.includes("cancel")) return "Annulee";
  return "Validee";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Erreur inconnue lors du chargement des commandes.";
}

function getStatusBadgeStyle(status: CommandeItemStatus): React.CSSProperties {
  if (status === "Livree") return { ...badgeStyle, background: "#d1fae5", color: "#065f46" };
  if (status === "Expediee") return { ...badgeStyle, background: "#dbeafe", color: "#1e3a8a" };
  if (status === "Annulee") return { ...badgeStyle, background: "#ffe4e6", color: "#9f1239" };
  if (status === "Brouillon") return { ...badgeStyle, background: "#e2e8f0", color: "#334155" };
  return { ...badgeStyle, background: "#fef3c7", color: "#92400e" };
}

const palette = {
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
const pageStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };
const pageHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", borderRadius: "20px", padding: "22px", boxShadow: cardShadow };
const pageTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.52rem", fontWeight: 900, color: palette.white };
const pageSubtitleStyle: React.CSSProperties = { margin: "8px 0 0", color: "#cbd5e1", fontSize: "0.92rem" };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap" };
const primaryButtonStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", background: actionGradient, color: palette.white, borderRadius: "12px", padding: "10px 15px", fontWeight: 900, cursor: "pointer", fontSize: "0.84rem", boxShadow: "0 10px 20px -14px rgba(49, 46, 129, 0.9)" };
const smallPrimaryButtonStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", background: actionGradient, color: palette.white, borderRadius: "12px", padding: "8px 12px", fontWeight: 900, cursor: "pointer", fontSize: "0.8rem", boxShadow: "0 10px 20px -14px rgba(49, 46, 129, 0.9)" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid rgba(226,232,240,0.35)", background: "rgba(255,255,255,0.08)", color: palette.white, borderRadius: "12px", padding: "10px 14px", fontWeight: 800, cursor: "pointer", fontSize: "0.85rem", backdropFilter: "blur(4px)" };
const secondaryButtonActiveStyle: React.CSSProperties = { border: "1px solid rgba(226,232,240,0.52)", background: "rgba(255,255,255,0.18)", color: palette.white };
const successBannerStyle: React.CSSProperties = { background: palette.mintSoft, color: palette.mintText, border: "1px solid #a7f3d0", borderRadius: "20px", padding: "10px 12px", fontWeight: 700, fontSize: "0.85rem" };
const warningBannerStyle: React.CSSProperties = { background: palette.salmonSoft, color: palette.salmonText, border: "1px solid #fecdd3", borderRadius: "20px", padding: "10px 12px", fontWeight: 700, fontSize: "0.85rem" };
const feedbackCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "20px", background: palette.white, padding: "16px", color: palette.slate500, fontWeight: 700, boxShadow: cardShadow };
const summaryCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "20px", background: palette.white, padding: "14px", display: "flex", flexDirection: "column", gap: "6px", boxShadow: cardShadow };
const summaryLabelStyle: React.CSSProperties = { color: palette.slate500, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" };
const summaryValueStyle: React.CSSProperties = { color: palette.slate900, fontSize: "1.18rem", fontWeight: 900 };
const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr", gap: "16px" });
const leftPaneStyle: React.CSSProperties = { minWidth: 0, background: palette.white, border: `1px solid ${palette.slate200}`, borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: cardShadow };
const rightPaneStyle: React.CSSProperties = { minWidth: 0, background: palette.white, border: `1px solid ${palette.slate200}`, borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: cardShadow };
const cardHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" };
const cardHeadingWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px" };
const cardTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.04rem", fontWeight: 900, color: palette.slate900 };
const countBadgeStyle: React.CSSProperties = { minWidth: "28px", height: "28px", borderRadius: "14px", background: palette.indigoSoft, color: palette.indigoDark, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, padding: "0 8px" };
const filtersCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc" };
const fieldInputStyle: React.CSSProperties = { border: `1px solid ${palette.slate300}`, borderRadius: "12px", padding: "10px 12px", fontSize: "0.88rem", color: palette.slate900, background: palette.white, outline: "none" };
const listWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", maxHeight: "620px", paddingRight: "2px" };
const getListItemStyle = (selected: boolean): React.CSSProperties => ({ border: selected ? `1px solid ${palette.indigoMain}` : `1px solid ${palette.slate200}`, borderRadius: "16px", background: selected ? "#eef2ff" : palette.white, padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", boxShadow: selected ? "0 12px 24px -20px rgba(67,56,202,0.55)" : "none" });
const itemContentButtonStyle: React.CSSProperties = { border: "none", background: "transparent", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px", padding: 0, cursor: "pointer", minWidth: 0 };
const itemTitleStyle: React.CSSProperties = { color: palette.slate900, fontSize: "0.92rem", fontWeight: 900 };
const itemMetaStyle: React.CSSProperties = { color: palette.slate500, fontSize: "0.78rem" };
const itemRightWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px" };
const menuWrapStyle: React.CSSProperties = { position: "relative" };
const menuButtonStyle: React.CSSProperties = { width: "34px", height: "34px", borderRadius: "10px", border: `1px solid ${palette.slate200}`, background: "#f8fafc", color: palette.slate700, cursor: "pointer", fontWeight: 800 };
const menuPopoverStyle: React.CSSProperties = { position: "absolute", right: 0, top: "38px", zIndex: 20, minWidth: "140px", borderRadius: "12px", border: `1px solid ${palette.slate200}`, background: palette.white, display: "flex", flexDirection: "column", gap: "4px", padding: "6px", boxShadow: cardShadow };
const menuActionStyle: React.CSSProperties = { border: "none", background: "#f8fafc", color: palette.slate700, borderRadius: "10px", padding: "8px 10px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 };
const menuDangerActionStyle: React.CSSProperties = { border: "none", background: palette.salmonSoft, color: palette.salmonText, borderRadius: "10px", padding: "8px 10px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 };
const detailCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "20px", background: palette.white, padding: "16px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: cardShadow };
const detailHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" };
const detailTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.2rem", fontWeight: 900, color: palette.slate900 };
const detailSubtitleStyle: React.CSSProperties = { margin: "5px 0 0", color: palette.slate500, fontSize: "0.84rem" };
const detailKpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px" };
const detailKpiCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "16px", background: palette.white, padding: "12px", display: "flex", flexDirection: "column", gap: "6px" };
const detailKpiLabelStyle: React.CSSProperties = { color: palette.slate500, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" };
const detailKpiValueStyle: React.CSSProperties = { color: palette.slate900, fontWeight: 900, fontSize: "1rem" };
const emptyStateStyle: React.CSSProperties = { minHeight: "170px", border: `1px dashed ${palette.slate300}`, borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: palette.slate500, fontWeight: 700, fontSize: "0.88rem", padding: "12px", background: "#f8fafc" };
const badgeStyle: React.CSSProperties = { borderRadius: "999px", padding: "6px 10px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" };
