"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/utils/supabase";

type DateFilter = "today" | "7d" | "30d";
type ChannelFilter = "Tous" | "Amazon" | "Shopify" | "Comptoir";
type SortDirection = "asc" | "desc";

type VenteDbRow = {
  id: string;
  date_vente: string;
  montant_ht: number | null;
  montant_ttc: number | null;
  statut: string | null;
  vendeur_id: string | null;
  canal?: string | null;
};

type VenteRow = {
  id: string;
  dateVente: string;
  montantHt: number;
  montantTtc: number;
  statut: string;
  vendeurId: string | null;
  vendeurNom: string;
  canal: Exclude<ChannelFilter, "Tous">;
};

type ProfileRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
};

type VenteItemRow = Record<string, unknown>;

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export default function VentesPage() {
  const [ventes, setVentes] = useState<VenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [searchId, setSearchId] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30d");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("Tous");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [selectedVenteId, setSelectedVenteId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [venteItems, setVenteItems] = useState<VenteItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVentes = async () => {
      setLoading(true);
      setLoadingError(null);

      try {
        const dataWithCanal = await supabase
          .from("ventes")
          .select("id, date_vente, montant_ht, montant_ttc, statut, vendeur_id, canal")
          .order("date_vente", { ascending: false });

        let ventesData = dataWithCanal.data as VenteDbRow[] | null;
        let ventesError = dataWithCanal.error;

        if (ventesError) {
          const dataFallback = await supabase
            .from("ventes")
            .select("id, date_vente, montant_ht, montant_ttc, statut, vendeur_id")
            .order("date_vente", { ascending: false });

          ventesData = dataFallback.data as VenteDbRow[] | null;
          ventesError = dataFallback.error;
        }

        if (ventesError) {
          throw ventesError;
        }

        const sourceRows = ventesData ?? [];
        const sellerIds = [...new Set(sourceRows.map((vente) => vente.vendeur_id).filter((id): id is string => Boolean(id)))];

        let profileById = new Map<string, string>();
        if (sellerIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, prenom, nom")
            .in("id", sellerIds);

          if (!profilesError && profilesData) {
            profileById = new Map(
              (profilesData as ProfileRow[]).map((profile) => {
                const fullName = [profile.prenom, profile.nom].filter(Boolean).join(" ").trim();
                return [profile.id, fullName.length > 0 ? fullName : "Vendeur inconnu"];
              }),
            );
          }
        }

        const mapped = sourceRows.map<VenteRow>((vente) => ({
          id: vente.id,
          dateVente: vente.date_vente,
          montantHt: toNumber(vente.montant_ht),
          montantTtc: toNumber(vente.montant_ttc),
          statut: vente.statut ?? "Inconnu",
          vendeurId: vente.vendeur_id,
          vendeurNom: vente.vendeur_id ? profileById.get(vente.vendeur_id) ?? "Vendeur inconnu" : "Vendeur inconnu",
          canal: normalizeChannel(vente.canal),
        }));

        if (!isMounted) return;
        setVentes(mapped);
      } catch (error) {
        if (!isMounted) return;
        setLoadingError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchVentes();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isDrawerOpen || !selectedVenteId) return;

    let isMounted = true;

    const fetchVenteItems = async () => {
      setItemsLoading(true);
      setItemsError(null);

      try {
        const { data, error } = await supabase.from("vente_items").select("*").eq("vente_id", selectedVenteId);
        if (error) {
          throw error;
        }
        if (!isMounted) return;
        setVenteItems((data ?? []) as VenteItemRow[]);
      } catch (error) {
        if (!isMounted) return;
        setItemsError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setItemsLoading(false);
        }
      }
    };

    void fetchVenteItems();

    return () => {
      isMounted = false;
    };
  }, [isDrawerOpen, selectedVenteId]);

  const filteredVentes = useMemo(() => {
    const threshold = getDateThreshold(dateFilter);
    const normalizedSearch = searchId.trim().toLowerCase();

    return ventes.filter((vente) => {
      const dateMatch = new Date(vente.dateVente).getTime() >= threshold.getTime();
      const channelMatch = channelFilter === "Tous" || vente.canal === channelFilter;
      const idMatch = normalizedSearch.length === 0 || vente.id.toLowerCase().includes(normalizedSearch);

      return dateMatch && channelMatch && idMatch;
    });
  }, [channelFilter, dateFilter, searchId, ventes]);

  const sortedVentes = useMemo(() => {
    return [...filteredVentes].sort((a, b) => {
      const timeA = new Date(a.dateVente).getTime();
      const timeB = new Date(b.dateVente).getTime();
      return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [filteredVentes, sortDirection]);

  const kpis = useMemo(() => {
    const visibleSales = ventes.filter((vente) => {
      const threshold = getDateThreshold(dateFilter);
      const dateMatch = new Date(vente.dateVente).getTime() >= threshold.getTime();
      const channelMatch = channelFilter === "Tous" || vente.canal === channelFilter;
      return dateMatch && channelMatch;
    });

    const totalRevenue = visibleSales.reduce((sum, vente) => sum + vente.montantTtc, 0);
    const transactions = visibleSales.length;
    const averageBasket = transactions > 0 ? totalRevenue / transactions : 0;

    const now = new Date();
    const currentWindow = getDateWindow(dateFilter, now);
    const previousWindow = getPreviousDateWindow(currentWindow);

    const currentRevenue = ventes.reduce((sum, vente) => {
      if (channelFilter !== "Tous" && vente.canal !== channelFilter) return sum;
      const ts = new Date(vente.dateVente).getTime();
      return ts >= currentWindow.start.getTime() && ts <= currentWindow.end.getTime() ? sum + vente.montantTtc : sum;
    }, 0);

    const previousRevenue = ventes.reduce((sum, vente) => {
      if (channelFilter !== "Tous" && vente.canal !== channelFilter) return sum;
      const ts = new Date(vente.dateVente).getTime();
      return ts >= previousWindow.start.getTime() && ts <= previousWindow.end.getTime() ? sum + vente.montantTtc : sum;
    }, 0);

    const growthRate = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      totalRevenue,
      transactions,
      averageBasket,
      growthRate,
    };
  }, [channelFilter, dateFilter, ventes]);

  const selectedVente = useMemo(() => {
    return ventes.find((vente) => vente.id === selectedVenteId) ?? null;
  }, [selectedVenteId, ventes]);

  const openDrawer = (venteId: string) => {
    setSelectedVenteId(venteId);
    setIsDrawerOpen(true);
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Pilotage des revenus</h1>
          <p style={descriptionStyle}>
            Centralisez les transactions, suivez la performance multi-canal et ouvrez le détail des ventes sans quitter le tableau.
          </p>
        </div>
        <button type="button" style={primaryButtonStyle}>
          + Nouvelle Vente
        </button>
      </header>

      <section style={kpiGridStyle}>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Chiffre d affaires total (TTC)</span>
          <strong style={kpiValueStyle}>{currencyFormatter.format(kpis.totalRevenue)}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Nombre de transactions</span>
          <strong style={kpiValueStyle}>{kpis.transactions}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Panier moyen</span>
          <strong style={kpiValueStyle}>{currencyFormatter.format(kpis.averageBasket)}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Taux de croissance</span>
          <strong style={{ ...kpiValueStyle, color: kpis.growthRate >= 0 ? "#0f766e" : "#b91c1c" }}>{formatPercent(kpis.growthRate)}</strong>
        </article>
      </section>

      <section style={filtersCardStyle}>
        <label style={filterControlStyle}>
          <span style={filterLabelStyle}>Recherche transaction</span>
          <input
            type="text"
            value={searchId}
            onChange={(event) => setSearchId(event.target.value)}
            placeholder="Ex: 3f0e8a9b"
            style={inputStyle}
          />
        </label>

        <label style={filterControlStyle}>
          <span style={filterLabelStyle}>Periode</span>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} style={inputStyle}>
            <option value="today">Aujourd hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </label>

        <label style={filterControlStyle}>
          <span style={filterLabelStyle}>Canal</span>
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)} style={inputStyle}>
            <option value="Tous">Tous</option>
            <option value="Amazon">Amazon</option>
            <option value="Shopify">Shopify</option>
            <option value="Comptoir">Comptoir</option>
          </select>
        </label>
      </section>

      <section style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <h2 style={tableTitleStyle}>Transactions</h2>
          <button type="button" style={sortButtonStyle} onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}>
            Trier par date: {sortDirection === "desc" ? "Plus recentes" : "Plus anciennes"}
          </button>
        </div>

        <div style={tableOverflowStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>ID Transaction</th>
                <th style={thStyle}>Canal</th>
                <th style={thStyle}>Vendeur</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Montant TTC</th>
                <th style={thStyle}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={feedbackCellStyle}>
                    Chargement des ventes...
                  </td>
                </tr>
              ) : loadingError ? (
                <tr>
                  <td colSpan={7} style={{ ...feedbackCellStyle, color: "#b91c1c" }}>
                    {loadingError}
                  </td>
                </tr>
              ) : sortedVentes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={feedbackCellStyle}>
                    Aucune transaction ne correspond aux filtres actifs.
                  </td>
                </tr>
              ) : (
                sortedVentes.map((vente) => (
                  <tr key={vente.id} style={tableRowStyle}>
                    <td style={tdStyle}>{formatDate(vente.dateVente)}</td>
                    <td style={tdStyle}>
                      <code style={codeTagStyle}>{truncateId(vente.id)}</code>
                    </td>
                    <td style={tdStyle}>{vente.canal}</td>
                    <td style={tdStyle}>{vente.vendeurNom}</td>
                    <td style={tdStyle}>
                      <span style={getStatusTagStyle(vente.statut)}>{vente.statut}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{currencyFormatter.format(vente.montantTtc)}</td>
                    <td style={tdStyle}>
                      <button type="button" style={detailButtonStyle} onClick={() => openDrawer(vente.id)}>
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isDrawerOpen ? (
        <div style={drawerOverlayStyle} onClick={() => setIsDrawerOpen(false)}>
          <aside style={drawerPanelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div>
                <h3 style={drawerTitleStyle}>Detail de la vente</h3>
                <p style={drawerSubtitleStyle}>{selectedVente ? truncateId(selectedVente.id) : "Transaction"}</p>
              </div>
              <button type="button" style={closeButtonStyle} onClick={() => setIsDrawerOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={drawerContentStyle}>
              {itemsLoading ? (
                <p style={drawerHintStyle}>Chargement des articles...</p>
              ) : itemsError ? (
                <p style={{ ...drawerHintStyle, color: "#b91c1c" }}>{itemsError}</p>
              ) : venteItems.length === 0 ? (
                <p style={drawerHintStyle}>Aucun article trouve pour cette vente.</p>
              ) : (
                venteItems.map((item, index) => {
                  const quantity = getNumericValue(item, ["quantite", "quantity", "qty"]);
                  const unitPrice = getNumericValue(item, ["prix_unitaire_ht", "prix_unitaire", "unit_price", "price"]);
                  const total = getNumericValue(item, ["total_ht", "total_ttc", "total"]);

                  return (
                    <article key={String(item.id ?? `${selectedVenteId}-${index}`)} style={itemCardStyle}>
                      <strong style={itemTitleStyle}>{getItemTitle(item, index)}</strong>
                      <div style={itemMetaStyle}>
                        <span>Quantite: {quantity ?? "-"}</span>
                        <span>PU: {unitPrice !== null ? currencyFormatter.format(unitPrice) : "-"}</span>
                        <span>Total: {total !== null ? currencyFormatter.format(total) : "-"}</span>
                      </div>
                    </article>
                  );
                })
              )}

              <div style={drawerPlaceholderStyle}>
                Emplacement pret pour enrichir le panneau (remises, taxes, marges, historique d actions).
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Une erreur est survenue pendant le chargement des ventes.";
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}...` : id;
}

function normalizeChannel(value?: string | null): Exclude<ChannelFilter, "Tous"> {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("amazon")) return "Amazon";
  if (normalized.includes("shopify")) return "Shopify";
  return "Comptoir";
}

function getDateThreshold(filter: DateFilter): Date {
  const now = new Date();
  if (filter === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const days = filter === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getDateWindow(filter: DateFilter, now: Date): { start: Date; end: Date } {
  if (filter === "today") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      end: now,
    };
  }
  const days = filter === "7d" ? 7 : 30;
  return {
    start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    end: now,
  };
}

function getPreviousDateWindow(window: { start: Date; end: Date }): { start: Date; end: Date } {
  const durationMs = window.end.getTime() - window.start.getTime();
  return {
    start: new Date(window.start.getTime() - durationMs),
    end: new Date(window.start.getTime()),
  };
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} %`;
}

function getStatusTagStyle(status: string): CSSProperties {
  const normalized = status.toLowerCase();
  const base: CSSProperties = {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 700,
  };

  if (
    normalized.includes("valide") ||
    normalized.includes("paye") ||
    normalized.includes("termine") ||
    normalized.includes("livre")
  ) {
    return { ...base, backgroundColor: "#dcfce7", color: "#166534" };
  }

  if (normalized.includes("attente") || normalized.includes("pending")) {
    return { ...base, backgroundColor: "#fef3c7", color: "#92400e" };
  }

  if (normalized.includes("annul") || normalized.includes("refus")) {
    return { ...base, backgroundColor: "#fee2e2", color: "#991b1b" };
  }

  return { ...base, backgroundColor: "#e2e8f0", color: "#334155" };
}

function getNumericValue(item: VenteItemRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function getItemTitle(item: VenteItemRow, index: number): string {
  const potentialKeys = ["nom_produit", "article_nom", "produit_nom", "product_name", "name"];
  for (const key of potentialKeys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return `Article ${index + 1}`;
}

const pageStyle: CSSProperties = {
  fontFamily: '"Inter", "Geist", sans-serif',
  color: "#0f172a",
  display: "grid",
  gap: "1.5rem",
};

const headerStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  padding: "1.5rem 1.75rem",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "center",
};

const titleStyle: CSSProperties = {
  fontSize: "1.8rem",
  lineHeight: 1.15,
  letterSpacing: "-0.02em",
  fontWeight: 700,
};

const descriptionStyle: CSSProperties = {
  marginTop: "0.5rem",
  color: "#475569",
  maxWidth: "62ch",
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: "#6366f1",
  color: "#ffffff",
  border: "none",
  borderRadius: "16px",
  height: "46px",
  padding: "0 1.25rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(99, 102, 241, 0.24)",
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const kpiCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  padding: "1.25rem",
  display: "grid",
  gap: "0.45rem",
};

const kpiLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const kpiValueStyle: CSSProperties = {
  fontSize: "1.45rem",
  fontWeight: 700,
};

const filtersCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  padding: "1.1rem",
  display: "grid",
  gap: "0.9rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
};

const filterControlStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const filterLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const inputStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  borderRadius: "14px",
  padding: "0.7rem 0.9rem",
  fontSize: "0.95rem",
  outline: "none",
};

const tableCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
};

const tableHeaderStyle: CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const tableTitleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
};

const sortButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0.5rem 0.75rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
};

const tableOverflowStyle: CSSProperties = {
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "840px",
};

const tableHeaderRowStyle: CSSProperties = {
  backgroundColor: "#f8fafc",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.9rem 1rem",
  color: "#64748b",
  fontSize: "0.74rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
};

const tableRowStyle: CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
};

const tdStyle: CSSProperties = {
  padding: "0.9rem 1rem",
  fontSize: "0.9rem",
  color: "#0f172a",
};

const codeTagStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.24rem 0.5rem",
  borderRadius: "10px",
  backgroundColor: "#eef2ff",
  color: "#4338ca",
  fontWeight: 700,
  fontSize: "0.78rem",
};

const detailButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: "0.82rem",
  padding: "0.42rem 0.65rem",
  cursor: "pointer",
};

const feedbackCellStyle: CSSProperties = {
  textAlign: "center",
  padding: "1.8rem 1rem",
  color: "#475569",
};

const drawerOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.2)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 40,
};

const drawerPanelStyle: CSSProperties = {
  width: "min(440px, 100vw)",
  height: "100%",
  backgroundColor: "#ffffff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-12px 0 28px rgba(15, 23, 42, 0.12)",
  padding: "1rem",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  gap: "1rem",
};

const drawerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: "0.8rem",
};

const drawerTitleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "#0f172a",
};

const drawerSubtitleStyle: CSSProperties = {
  marginTop: "0.25rem",
  color: "#64748b",
  fontSize: "0.82rem",
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  padding: "0.45rem 0.7rem",
  cursor: "pointer",
  fontWeight: 600,
};

const drawerContentStyle: CSSProperties = {
  overflowY: "auto",
  display: "grid",
  gap: "0.75rem",
  alignContent: "start",
};

const drawerHintStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.9rem",
};

const itemCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "0.85rem",
  backgroundColor: "#ffffff",
};

const itemTitleStyle: CSSProperties = {
  display: "block",
  color: "#0f172a",
  marginBottom: "0.35rem",
  fontSize: "0.92rem",
};

const itemMetaStyle: CSSProperties = {
  display: "flex",
  gap: "0.7rem",
  flexWrap: "wrap",
  color: "#475569",
  fontSize: "0.8rem",
};

const drawerPlaceholderStyle: CSSProperties = {
  marginTop: "0.6rem",
  borderRadius: "16px",
  border: "1px dashed #cbd5e1",
  padding: "0.85rem",
  color: "#64748b",
  fontSize: "0.8rem",
};
