"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";

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
  const [organisationId, setOrganisationId] = useState<string>("");
  const [ventes, setVentes] = useState<VenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [searchId, setSearchId] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30d");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("Tous");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showFilters, setShowFilters] = useState(true);

  const [selectedVenteId, setSelectedVenteId] = useState<string | null>(null);
  const [menuVenteId, setMenuVenteId] = useState<string | null>(null);
  const [venteItems, setVenteItems] = useState<VenteItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => {
      window.removeEventListener("resize", syncLayout);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchVentes = async () => {
      setLoading(true);
      setLoadingError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Session introuvable.");
        }

        if (isKipiloteStaff(session.user)) {
          setActiveUniverse("hq");
          throw new Error("Acces staff HQ interdit sur le backoffice client.");
        }

        setActiveUniverse("client");
        const orgId = getOrganisationId(session.user);
        if (!orgId) {
          throw new Error("organisation_id manquant dans la session.");
        }

        setOrganisationId(orgId);

        const dataWithCanal = await supabase
          .from("ventes")
          .select("id, date_vente, montant_ht, montant_ttc, statut, vendeur_id, canal")
          .eq("organisation_id", orgId)
          .order("date_vente", { ascending: false });

        let ventesData = dataWithCanal.data as VenteDbRow[] | null;
        let ventesError = dataWithCanal.error;

        if (ventesError) {
          const dataFallback = await supabase
            .from("ventes")
            .select("id, date_vente, montant_ht, montant_ttc, statut, vendeur_id")
            .eq("organisation_id", orgId)
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
            .eq("organisation_id", orgId)
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
        setSelectedVenteId((current) => {
          if (current && mapped.some((vente) => vente.id === current)) {
            return current;
          }
          return mapped[0]?.id ?? null;
        });
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
    if (!selectedVenteId || !organisationId) {
      setVenteItems([]);
      return;
    }

    let isMounted = true;

    const fetchVenteItems = async () => {
      setItemsLoading(true);
      setItemsError(null);

      try {
        const { data, error } = await supabase
          .from("vente_items")
          .select("*")
          .eq("organisation_id", organisationId)
          .eq("vente_id", selectedVenteId);
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
  }, [organisationId, selectedVenteId]);

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
    return sortedVentes.find((vente) => vente.id === selectedVenteId) ?? sortedVentes[0] ?? null;
  }, [selectedVenteId, sortedVentes]);

  const handleExportCsv = () => {
    if (sortedVentes.length === 0) {
      return;
    }

    const header = ["id", "date_vente", "canal", "vendeur", "statut", "montant_ttc"];
    const lines = sortedVentes.map((vente) => {
      return [vente.id, vente.dateVente, vente.canal, vente.vendeurNom, vente.statut, String(vente.montantTtc)]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ventes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteVente = async (id: string) => {
    const confirmed = confirm("Supprimer cette vente ?");
    if (!confirmed) {
      return;
    }

    if (!organisationId) {
      setActionError("Organisation introuvable.");
      return;
    }

    const { error } = await supabase.from("ventes").delete().eq("id", id).eq("organisation_id", organisationId);
    if (error) {
      setActionError(error.message);
      return;
    }

    setVentes((current) => current.filter((vente) => vente.id !== id));
    setMenuVenteId(null);
    setInfoMessage("Vente supprimee.");
    setSelectedVenteId((current) => (current === id ? null : current));
  };

  if (loading) {
    return <section style={feedbackCardStyle}>Chargement des ventes...</section>;
  }

  if (loadingError) {
    return <section style={{ ...feedbackCardStyle, ...warningBannerStyle }}>Erreur: {loadingError}</section>;
  }

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Ventes</h1>
          <p style={pageSubtitleStyle}>Transactions multi-canales, performance et detail ligne par ligne.</p>
        </div>

        <div style={headerActionsStyle}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, ...(showFilters ? secondaryButtonActiveStyle : {}) }}
            onClick={() => setShowFilters((current) => !current)}
          >
            Filtres
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleExportCsv}>
            Export
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => setInfoMessage("Creation manuelle disponible via le flux de caisse.")}
          >
            Import / Ajouter
          </button>
        </div>
      </header>

      {infoMessage ? <div style={successBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={warningBannerStyle}>{actionError}</div> : null}

      <div style={summaryGridStyle}>
        <article style={summaryCardStyle}>
          <span style={summaryLabelStyle}>CA TTC</span>
          <strong style={summaryValueStyle}>{currencyFormatter.format(kpis.totalRevenue)}</strong>
        </article>
        <article style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Transactions</span>
          <strong style={summaryValueStyle}>{kpis.transactions}</strong>
        </article>
        <article style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Panier moyen</span>
          <strong style={summaryValueStyle}>{currencyFormatter.format(kpis.averageBasket)}</strong>
        </article>
        <article style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Croissance</span>
          <strong style={{ ...summaryValueStyle, color: kpis.growthRate >= 0 ? palette.mintText : palette.salmonText }}>{formatPercent(kpis.growthRate)}</strong>
        </article>
      </div>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={leftPaneStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardHeadingWrapStyle}>
              <h2 style={cardTitleStyle}>Transactions</h2>
              <span style={countBadgeStyle}>{sortedVentes.length}</span>
            </div>
            <button
              type="button"
              style={smallPrimaryButtonStyle}
              onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
            >
              Trier
            </button>
          </div>

          {showFilters ? (
            <div style={filtersCardStyle}>
              <input
                type="text"
                value={searchId}
                onChange={(event) => setSearchId(event.target.value)}
                placeholder="Recherche ID transaction"
                style={fieldInputStyle}
              />

              <div style={filtersRowStyle}>
                <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} style={fieldInputStyle}>
                  <option value="today">Aujourd hui</option>
                  <option value="7d">7 derniers jours</option>
                  <option value="30d">30 derniers jours</option>
                </select>
                <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)} style={fieldInputStyle}>
                  <option value="Tous">Tous</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Comptoir">Comptoir</option>
                </select>
              </div>
            </div>
          ) : null}

          <div style={listWrapStyle}>
            {sortedVentes.length === 0 ? (
              <div style={emptyStateStyle}>Aucune transaction ne correspond aux filtres actifs.</div>
            ) : (
              sortedVentes.map((vente) => {
                const isSelected = vente.id === selectedVente?.id;

                return (
                  <article key={vente.id} style={getListItemStyle(isSelected)}>
                    <button
                      type="button"
                      style={itemContentButtonStyle}
                      onClick={() => {
                        setSelectedVenteId(vente.id);
                        setMenuVenteId(null);
                      }}
                    >
                      <strong style={itemTitleStyle}>{truncateId(vente.id)}</strong>
                      <span style={itemMetaStyle}>{formatDate(vente.dateVente)}</span>
                      <span style={itemMetaStyle}>{currencyFormatter.format(vente.montantTtc)}</span>
                    </button>

                    <div style={itemRightWrapStyle}>
                      <span style={getStatusTagStyle(vente.statut)}>{vente.statut}</span>

                      <div style={menuWrapStyle}>
                        <button
                          type="button"
                          style={menuButtonStyle}
                          onClick={() => setMenuVenteId((current) => (current === vente.id ? null : vente.id))}
                        >
                          ⋮
                        </button>
                        {menuVenteId === vente.id ? (
                          <div style={menuPopoverStyle}>
                            <button
                              type="button"
                              style={menuActionStyle}
                              onClick={() => {
                                setSelectedVenteId(vente.id);
                                setMenuVenteId(null);
                              }}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              style={menuActionStyle}
                              onClick={() => {
                                setSelectedVenteId(vente.id);
                                setMenuVenteId(null);
                                setInfoMessage("Edition disponible sur le workflow caisse.");
                              }}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              style={menuDangerActionStyle}
                              onClick={() => void handleDeleteVente(vente.id)}
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
          {selectedVente ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <h2 style={detailTitleStyle}>Vente {truncateId(selectedVente.id)}</h2>
                  <p style={detailSubtitleStyle}>{formatDate(selectedVente.dateVente)}</p>
                </div>
                <span style={getStatusTagStyle(selectedVente.statut)}>{selectedVente.statut}</span>
              </div>

              <div style={detailKpiGridStyle}>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Canal</span>
                  <strong style={detailKpiValueStyle}>{selectedVente.canal}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Vendeur</span>
                  <strong style={detailKpiValueStyle}>{selectedVente.vendeurNom}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Montant HT</span>
                  <strong style={detailKpiValueStyle}>{currencyFormatter.format(selectedVente.montantHt)}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Montant TTC</span>
                  <strong style={detailKpiValueStyle}>{currencyFormatter.format(selectedVente.montantTtc)}</strong>
                </div>
              </div>

              <div style={itemsCardStyle}>
                <h3 style={itemsTitleStyle}>Articles de la vente</h3>
                {itemsLoading ? (
                  <p style={itemsHintStyle}>Chargement des articles...</p>
                ) : itemsError ? (
                  <p style={{ ...itemsHintStyle, color: palette.salmonText }}>{itemsError}</p>
                ) : venteItems.length === 0 ? (
                  <p style={itemsHintStyle}>Aucun article trouve pour cette vente.</p>
                ) : (
                  <div style={itemsListStyle}>
                    {venteItems.map((item, index) => {
                      const quantity = getNumericValue(item, ["quantite", "quantity", "qty"]);
                      const unitPrice = getNumericValue(item, ["prix_unitaire_ht", "prix_unitaire", "unit_price", "price"]);
                      const total = getNumericValue(item, ["total_ht", "total_ttc", "total"]);

                      return (
                        <article key={String(item.id ?? `${selectedVenteId}-${index}`)} style={itemRowCardStyle}>
                          <strong style={itemRowTitleStyle}>{getItemTitle(item, index)}</strong>
                          <span style={itemRowMetaStyle}>Quantite: {quantity ?? "-"}</span>
                          <span style={itemRowMetaStyle}>PU: {unitPrice !== null ? currencyFormatter.format(unitPrice) : "-"}</span>
                          <span style={itemRowMetaStyle}>Total: {total !== null ? currencyFormatter.format(total) : "-"}</span>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          ) : (
            <div style={emptyStateStyle}>Selectionnez une transaction a gauche.</div>
          )}
        </section>
      </div>
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
    whiteSpace: "nowrap",
  };

  if (
    normalized.includes("valide") ||
    normalized.includes("paye") ||
    normalized.includes("termine") ||
    normalized.includes("livre")
  ) {
    return { ...base, backgroundColor: "#d1fae5", color: "#065f46" };
  }

  if (normalized.includes("attente") || normalized.includes("pending")) {
    return { ...base, backgroundColor: "#fef3c7", color: "#92400e" };
  }

  if (normalized.includes("annul") || normalized.includes("refus")) {
    return { ...base, backgroundColor: "#ffe4e6", color: "#9f1239" };
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

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.52rem",
  fontWeight: 900,
  color: palette.white,
};

const pageSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "0.92rem",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
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

const smallPrimaryButtonStyle: CSSProperties = {
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

const secondaryButtonStyle: CSSProperties = {
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

const secondaryButtonActiveStyle: CSSProperties = {
  border: "1px solid rgba(226,232,240,0.52)",
  background: "rgba(255,255,255,0.18)",
  color: palette.white,
};

const successBannerStyle: CSSProperties = {
  background: palette.mintSoft,
  color: palette.mintText,
  border: "1px solid #a7f3d0",
  borderRadius: "20px",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const warningBannerStyle: CSSProperties = {
  background: palette.salmonSoft,
  color: palette.salmonText,
  border: "1px solid #fecdd3",
  borderRadius: "20px",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const feedbackCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "16px",
  color: palette.slate500,
  fontWeight: 700,
  boxShadow: cardShadow,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "14px",
};

const summaryCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  boxShadow: cardShadow,
};

const summaryLabelStyle: CSSProperties = {
  color: palette.slate500,
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const summaryValueStyle: CSSProperties = {
  color: palette.slate900,
  fontSize: "1.18rem",
  fontWeight: 900,
};

const getDualPaneStyle = (compact: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
});

const leftPaneStyle: CSSProperties = {
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

const rightPaneStyle: CSSProperties = {
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

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const cardHeadingWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.04rem",
  fontWeight: 900,
  color: palette.slate900,
};

const countBadgeStyle: CSSProperties = {
  minWidth: "28px",
  height: "28px",
  borderRadius: "14px",
  background: palette.indigoSoft,
  color: palette.indigoDark,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.78rem",
  fontWeight: 800,
  padding: "0 8px",
};

const filtersCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  background: "#f8fafc",
};

const filtersRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
};

const fieldInputStyle: CSSProperties = {
  border: `1px solid ${palette.slate300}`,
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "0.88rem",
  color: palette.slate900,
  background: palette.white,
  outline: "none",
};

const listWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  overflowY: "auto",
  maxHeight: "620px",
  paddingRight: "2px",
};

const getListItemStyle = (selected: boolean): CSSProperties => ({
  border: selected ? `1px solid ${palette.indigoMain}` : `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  background: selected ? "#eef2ff" : palette.white,
  padding: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  boxShadow: selected ? "0 12px 24px -20px rgba(67,56,202,0.55)" : "none",
});

const itemContentButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: 0,
  cursor: "pointer",
  minWidth: 0,
};

const itemTitleStyle: CSSProperties = {
  color: palette.slate900,
  fontSize: "0.92rem",
  fontWeight: 900,
};

const itemMetaStyle: CSSProperties = {
  color: palette.slate500,
  fontSize: "0.78rem",
};

const itemRightWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const menuWrapStyle: CSSProperties = {
  position: "relative",
};

const menuButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  border: `1px solid ${palette.slate200}`,
  background: "#f8fafc",
  color: palette.slate700,
  cursor: "pointer",
  fontWeight: 800,
};

const menuPopoverStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "38px",
  zIndex: 20,
  minWidth: "140px",
  borderRadius: "12px",
  border: `1px solid ${palette.slate200}`,
  background: palette.white,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "6px",
  boxShadow: cardShadow,
};

const menuActionStyle: CSSProperties = {
  border: "none",
  background: "#f8fafc",
  color: palette.slate700,
  borderRadius: "10px",
  padding: "8px 10px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const menuDangerActionStyle: CSSProperties = {
  border: "none",
  background: palette.salmonSoft,
  color: palette.salmonText,
  borderRadius: "10px",
  padding: "8px 10px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const detailCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: cardShadow,
};

const detailHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  flexWrap: "wrap",
};

const detailTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  fontWeight: 900,
  color: palette.slate900,
};

const detailSubtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: palette.slate500,
  fontSize: "0.84rem",
};

const detailKpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "14px",
};

const detailKpiCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  background: palette.white,
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const detailKpiLabelStyle: CSSProperties = {
  color: palette.slate500,
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const detailKpiValueStyle: CSSProperties = {
  color: palette.slate900,
  fontWeight: 900,
  fontSize: "1rem",
};

const itemsCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  background: palette.white,
  padding: "14px",
};

const itemsTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  fontWeight: 900,
  color: palette.slate900,
};

const itemsHintStyle: CSSProperties = {
  margin: "8px 0 0",
  color: palette.slate500,
  fontSize: "0.84rem",
};

const itemsListStyle: CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gap: "10px",
};

const itemRowCardStyle: CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "16px",
  padding: "12px",
  display: "grid",
  gap: "5px",
  background: "#f8fafc",
};

const itemRowTitleStyle: CSSProperties = {
  color: palette.slate900,
  fontSize: "0.85rem",
  fontWeight: 900,
};

const itemRowMetaStyle: CSSProperties = {
  color: palette.slate700,
  fontSize: "0.8rem",
};

const emptyStateStyle: CSSProperties = {
  minHeight: "170px",
  border: `1px dashed ${palette.slate300}`,
  borderRadius: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: palette.slate500,
  fontWeight: 700,
  fontSize: "0.88rem",
  padding: "12px",
  background: "#f8fafc",
};
