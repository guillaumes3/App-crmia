"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, getClientsByOrganisation, type ClientRow, type ClientSource, type ClientStatus } from "@/app/services/clients";
import { supabase } from "@/utils/supabase";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";

type ClientFormState = {
  fullName: string;
  email: string;
  phone: string;
  source: ClientSource;
  status: ClientStatus;
  segment: string;
  ordersCount: number;
  averageBasket: number;
  totalSpent: number;
  lastOrderDate: string;
  churnRisk: number;
  nextActions: string;
};

type RightPaneMode = "details" | "create";

const statusOptions: Array<"Tous" | ClientStatus> = ["Tous", "VIP", "Actif", "A relancer", "Inactif"];
const sourceOptions: Array<"Toutes" | ClientSource> = ["Toutes", "Shopify", "Amazon", "Site"];

const initialFormState: ClientFormState = {
  fullName: "",
  email: "",
  phone: "",
  source: "Site",
  status: "Actif",
  segment: "Non defini",
  ordersCount: 0,
  averageBasket: 0,
  totalSpent: 0,
  lastOrderDate: "",
  churnRisk: 0,
  nextActions: "",
};

const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function ClientsPage() {
  const [organisationId, setOrganisationId] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Tous" | ClientStatus>("Tous");
  const [sourceFilter, setSourceFilter] = useState<"Toutes" | ClientSource>("Toutes");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("details");
  const [showFilters, setShowFilters] = useState(true);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);

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

    const bootstrap = async () => {
      setLoading(true);
      setLoadingError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Session non trouvee.");
        }

        if (isKipiloteStaff(session.user)) {
          setActiveUniverse("hq");
          throw new Error("Acces staff HQ interdit sur le CRM client.");
        }

        setActiveUniverse("client");
        const orgId = getOrganisationId(session.user);
        if (!orgId) {
          throw new Error("organisation_id manquant dans la session.");
        }

        const data = await getClientsByOrganisation(orgId);
        if (!isMounted) return;

        setOrganisationId(orgId);
        setClients(data);
        setSelectedClientId((current) => {
          if (current && data.some((client) => client.id === current)) {
            return current;
          }
          return data[0]?.id ?? null;
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

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return clients.filter((client) => {
      const fullName = client.full_name.toLowerCase();
      const email = client.email.toLowerCase();
      const searchMatch = normalizedSearch.length === 0 || fullName.includes(normalizedSearch) || email.includes(normalizedSearch);
      const statusMatch = statusFilter === "Tous" || client.status === statusFilter;
      const sourceMatch = sourceFilter === "Toutes" || client.source === sourceFilter;

      return searchMatch && statusMatch && sourceMatch;
    });
  }, [clients, search, sourceFilter, statusFilter]);

  const selectedClient = useMemo(() => {
    return filteredClients.find((client) => client.id === selectedClientId) ?? filteredClients[0] ?? null;
  }, [filteredClients, selectedClientId]);

  const kpis = useMemo(() => {
    const totalRevenue = filteredClients.reduce((sum, client) => sum + toNumber(client.total_spent), 0);
    const vipClients = filteredClients.filter((client) => client.status === "VIP").length;
    const toRevive = filteredClients.filter((client) => client.status === "A relancer" || client.status === "Inactif").length;
    const avgBasket =
      filteredClients.length > 0
        ? filteredClients.reduce((sum, client) => sum + toNumber(client.average_basket), 0) / filteredClients.length
        : 0;

    return { totalRevenue, vipClients, toRevive, avgBasket };
  }, [filteredClients]);

  const handleCreateClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId) {
      setSaveError("Organisation non detectee.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const created = await createClient({
        organisationId,
        fullName: formState.fullName,
        email: formState.email,
        phone: formState.phone,
        source: formState.source,
        status: formState.status,
        segment: formState.segment,
        ordersCount: formState.ordersCount,
        averageBasket: formState.averageBasket,
        totalSpent: formState.totalSpent,
        lastOrderDate: formState.lastOrderDate || undefined,
        churnRisk: formState.churnRisk,
        nextActions: formState.nextActions
          .split("\n")
          .map((action) => action.trim())
          .filter(Boolean),
      });

      setClients((current) => [created, ...current]);
      setSelectedClientId(created.id);
      setFormState(initialFormState);
      setRightPaneMode("details");
      setInfoMessage("Client cree avec succes.");
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!organisationId) {
      return;
    }

    const confirmed = confirm("Supprimer ce client ?");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("clients").delete().eq("id", id).eq("organisation_id", organisationId);
    if (error) {
      setActionError(error.message);
      return;
    }

    setClients((current) => current.filter((client) => client.id !== id));
    setSelectedClientId((current) => (current === id ? null : current));
    setMenuClientId(null);
    setInfoMessage("Client supprime.");
  };

  const handleExportCsv = () => {
    if (filteredClients.length === 0) return;

    const header = ["Nom", "Email", "Telephone", "Source", "Statut", "Segment", "Commandes", "Panier Moyen", "Total Depense", "Dernier Achat", "Risque Churn"];
    const lines = filteredClients.map((client) => {
      return [
        client.full_name,
        client.email,
        client.phone ?? "",
        client.source,
        client.status,
        client.segment ?? "",
        String(client.orders_count ?? 0),
        String(client.average_basket ?? 0),
        String(client.total_spent ?? 0),
        client.last_order_date ?? "",
        String(client.churn_risk ?? 0),
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crm_clients.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <section style={feedbackCardStyle}>Chargement des clients...</section>;
  }

  if (loadingError) {
    return <section style={{ ...feedbackCardStyle, ...warningBannerStyle }}>Erreur: {loadingError}</section>;
  }

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Clients</h1>
          <p style={pageSubtitleStyle}>Suivi CRM, segmentation et actions commerciales.</p>
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
            onClick={() => {
              setRightPaneMode("create");
              setMenuClientId(null);
              setSaveError(null);
            }}
          >
            Import / Ajouter
          </button>
        </div>
      </header>

      {infoMessage ? <div style={successBannerStyle}>{infoMessage}</div> : null}
      {actionError ? <div style={warningBannerStyle}>{actionError}</div> : null}
      {saveError ? <div style={warningBannerStyle}>{saveError}</div> : null}

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={leftPaneStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardHeadingWrapStyle}>
              <h2 style={cardTitleStyle}>Base clients</h2>
              <span style={countBadgeStyle}>{filteredClients.length}</span>
            </div>
            <button
              type="button"
              style={smallPrimaryButtonStyle}
              onClick={() => {
                setRightPaneMode("create");
                setMenuClientId(null);
              }}
            >
              + Ajouter
            </button>
          </div>

          {showFilters ? (
            <div style={filtersCardStyle}>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher nom ou email"
                style={fieldInputStyle}
              />

              <div style={filtersRowStyle}>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "Tous" | ClientStatus)}
                  style={fieldInputStyle}
                  aria-label="Filtrer par statut"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as "Toutes" | ClientSource)}
                  style={fieldInputStyle}
                  aria-label="Filtrer par source"
                >
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <div style={listWrapStyle}>
            {filteredClients.length === 0 ? (
              <div style={emptyStateStyle}>Aucun client ne correspond aux filtres.</div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = client.id === selectedClient?.id;

                return (
                  <article key={client.id} style={getListItemStyle(isSelected)}>
                    <button
                      type="button"
                      style={itemContentButtonStyle}
                      onClick={() => {
                        setSelectedClientId(client.id);
                        setRightPaneMode("details");
                        setMenuClientId(null);
                      }}
                    >
                      <strong style={itemTitleStyle}>{client.full_name}</strong>
                      <span style={itemMetaStyle}>{client.email}</span>
                      <span style={itemMetaStyle}>{formatDate(client.last_order_date)}</span>
                    </button>

                    <div style={itemRightWrapStyle}>
                      <span style={getStatusBadgeStyle(client.status)}>{client.status}</span>
                      <span style={getSourceBadgeStyle(client.source)}>{client.source}</span>

                      <div style={menuWrapStyle}>
                        <button
                          type="button"
                          style={menuButtonStyle}
                          onClick={() => setMenuClientId((current) => (current === client.id ? null : client.id))}
                        >
                          ⋮
                        </button>
                        {menuClientId === client.id ? (
                          <div style={menuPopoverStyle}>
                            <button
                              type="button"
                              style={menuActionStyle}
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setRightPaneMode("details");
                                setMenuClientId(null);
                              }}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              style={menuActionStyle}
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setRightPaneMode("create");
                                setMenuClientId(null);
                              }}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              style={menuDangerActionStyle}
                              onClick={() => void handleDeleteClient(client.id)}
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
                <h2 style={detailTitleStyle}>Nouveau client</h2>
                <span style={modeTagStyle}>Creation</span>
              </div>

              <form style={formStyle} onSubmit={handleCreateClient}>
                <div style={formGridStyle}>
                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Nom complet *</span>
                    <input
                      required
                      value={formState.fullName}
                      onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Email *</span>
                    <input
                      required
                      type="email"
                      value={formState.email}
                      onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Telephone</span>
                    <input
                      value={formState.phone}
                      onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Segment</span>
                    <input
                      value={formState.segment}
                      onChange={(event) => setFormState((current) => ({ ...current, segment: event.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Source</span>
                    <select
                      value={formState.source}
                      onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value as ClientSource }))}
                      style={fieldInputStyle}
                    >
                      {sourceOptions
                        .filter((source) => source !== "Toutes")
                        .map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Statut</span>
                    <select
                      value={formState.status}
                      onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as ClientStatus }))}
                      style={fieldInputStyle}
                    >
                      {statusOptions
                        .filter((status) => status !== "Tous")
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Nb commandes</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.ordersCount}
                      onChange={(event) => setFormState((current) => ({ ...current, ordersCount: toNumber(event.target.value) }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Panier moyen</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.averageBasket}
                      onChange={(event) => setFormState((current) => ({ ...current, averageBasket: toNumber(event.target.value) }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Total depense</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.totalSpent}
                      onChange={(event) => setFormState((current) => ({ ...current, totalSpent: toNumber(event.target.value) }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Dernier achat</span>
                    <input
                      type="date"
                      value={formState.lastOrderDate}
                      onChange={(event) => setFormState((current) => ({ ...current, lastOrderDate: event.target.value }))}
                      style={fieldInputStyle}
                    />
                  </label>

                  <label style={fieldGroupStyle}>
                    <span style={fieldLabelStyle}>Risque churn (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formState.churnRisk}
                      onChange={(event) => setFormState((current) => ({ ...current, churnRisk: clamp(toNumber(event.target.value), 0, 100) }))}
                      style={fieldInputStyle}
                    />
                  </label>
                </div>

                <label style={fieldGroupStyle}>
                  <span style={fieldLabelStyle}>Actions recommandees (une par ligne)</span>
                  <textarea
                    rows={4}
                    value={formState.nextActions}
                    onChange={(event) => setFormState((current) => ({ ...current, nextActions: event.target.value }))}
                    style={{ ...fieldInputStyle, resize: "vertical" }}
                    placeholder={"Proposer un bundle premium\nRelancer via email J+7"}
                  />
                </label>

                <div style={formActionsStyle}>
                  <button type="button" style={secondaryButtonStyle} onClick={() => setRightPaneMode("details")}>
                    Annuler
                  </button>
                  <button type="submit" style={primaryButtonStyle} disabled={saving}>
                    {saving ? "Enregistrement..." : "Creer le client"}
                  </button>
                </div>
              </form>
            </article>
          ) : selectedClient ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <h2 style={detailTitleStyle}>{selectedClient.full_name}</h2>
                  <p style={detailSubtitleStyle}>{selectedClient.email}</p>
                </div>
                <span style={getStatusBadgeStyle(selectedClient.status)}>{selectedClient.status}</span>
              </div>

              <div style={detailKpiGridStyle}>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Segment</span>
                  <strong style={detailKpiValueStyle}>{selectedClient.segment || "Non defini"}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Commandes</span>
                  <strong style={detailKpiValueStyle}>{toNumber(selectedClient.orders_count)}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Panier moyen</span>
                  <strong style={detailKpiValueStyle}>{formatEuros.format(toNumber(selectedClient.average_basket))}</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Risque churn</span>
                  <strong style={detailKpiValueStyle}>{Math.round(toNumber(selectedClient.churn_risk))}%</strong>
                </div>
              </div>

              <div style={insightCardStyle}>
                <strong style={insightTitleStyle}>Insight IA</strong>
                <p style={insightTextStyle}>
                  {filteredClients.filter((client) => client.status === "VIP" && client.source === "Shopify").length > 0
                    ? "Le segment VIP Shopify reste le plus rentable. Une campagne de cross sell est recommandee."
                    : "Aucun VIP Shopify detecte. Priorisez une campagne de conversion sur les clients Actifs."}
                </p>
              </div>

              <div style={actionsCardStyle}>
                <h3 style={actionsTitleStyle}>Actions recommandees</h3>
                <ul style={actionsListStyle}>
                  {(selectedClient.next_actions && selectedClient.next_actions.length > 0
                    ? selectedClient.next_actions
                    : ["Aucune action definie pour ce client."]
                  ).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <div style={summaryGridStyle}>
                <div style={summaryCardStyle}>
                  <span style={summaryLabelStyle}>Revenus clients filtres</span>
                  <strong style={summaryValueStyle}>{formatEuros.format(kpis.totalRevenue)}</strong>
                </div>
                <div style={summaryCardStyle}>
                  <span style={summaryLabelStyle}>VIP</span>
                  <strong style={summaryValueStyle}>{kpis.vipClients}</strong>
                </div>
                <div style={summaryCardStyle}>
                  <span style={summaryLabelStyle}>A recontacter</span>
                  <strong style={summaryValueStyle}>{kpis.toRevive}</strong>
                </div>
                <div style={summaryCardStyle}>
                  <span style={summaryLabelStyle}>Panier moyen</span>
                  <strong style={summaryValueStyle}>{formatEuros.format(kpis.avgBasket)}</strong>
                </div>
              </div>
            </article>
          ) : (
            <div style={emptyStateStyle}>Selectionnez un client a gauche.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString("fr-FR");
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Une erreur est survenue.";
}

const palette = {
  white: "#ffffff",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  indigoSoft: "#e0e7ff",
  indigoMain: "#6366f1",
  indigoDark: "#4338ca",
  mintSoft: "#d1fae5",
  mintText: "#065f46",
  salmonSoft: "#ffe4e6",
  salmonText: "#9f1239",
};

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  background: palette.white,
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "18px",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.45rem",
  fontWeight: 800,
  color: palette.slate900,
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: palette.slate500,
  fontSize: "0.9rem",
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: palette.indigoMain,
  color: palette.white,
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: palette.indigoMain,
  color: palette.white,
  borderRadius: "12px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "0.8rem",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate300}`,
  background: palette.white,
  color: palette.slate700,
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const secondaryButtonActiveStyle: React.CSSProperties = {
  border: `1px solid ${palette.indigoMain}`,
  color: palette.indigoDark,
  background: palette.indigoSoft,
};

const successBannerStyle: React.CSSProperties = {
  background: palette.mintSoft,
  color: palette.mintText,
  border: "1px solid #a7f3d0",
  borderRadius: "20px",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const warningBannerStyle: React.CSSProperties = {
  background: palette.salmonSoft,
  color: palette.salmonText,
  border: "1px solid #fecdd3",
  borderRadius: "20px",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const feedbackCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "16px",
  color: palette.slate500,
  fontWeight: 700,
};

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "flex",
  flexDirection: compact ? "column" : "row",
  gap: "16px",
});

const leftPaneStyle: React.CSSProperties = {
  flex: "0 0 40%",
  minWidth: 0,
  background: palette.white,
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const rightPaneStyle: React.CSSProperties = {
  flex: "1 1 60%",
  minWidth: 0,
  background: palette.white,
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const cardHeadingWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.03rem",
  fontWeight: 800,
  color: palette.slate900,
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
  fontSize: "0.78rem",
  fontWeight: 800,
  padding: "0 8px",
};

const filtersCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  background: "#f8fafc",
};

const filtersRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "8px",
};

const listWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  overflowY: "auto",
  maxHeight: "620px",
};

const getListItemStyle = (selected: boolean): React.CSSProperties => ({
  border: selected ? `1px solid ${palette.indigoMain}` : `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: selected ? palette.indigoSoft : palette.white,
  padding: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

const itemContentButtonStyle: React.CSSProperties = {
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

const itemTitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 800,
  color: palette.slate900,
};

const itemMetaStyle: React.CSSProperties = {
  color: palette.slate500,
  fontSize: "0.78rem",
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
  border: `1px solid ${palette.slate300}`,
  background: palette.white,
  color: palette.slate700,
  cursor: "pointer",
  fontWeight: 800,
};

const menuPopoverStyle: React.CSSProperties = {
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
  boxShadow: "0 18px 30px -22px rgba(15,23,42,0.6)",
};

const menuActionStyle: React.CSSProperties = {
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

const menuDangerActionStyle: React.CSSProperties = {
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

const detailCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: "#f8fafc",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  flexWrap: "wrap",
};

const detailTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  fontWeight: 800,
  color: palette.slate900,
};

const detailSubtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: palette.slate500,
  fontSize: "0.84rem",
};

const modeTagStyle: React.CSSProperties = {
  background: palette.indigoSoft,
  color: palette.indigoDark,
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const detailKpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
};

const detailKpiCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  borderRadius: "20px",
  background: palette.white,
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const detailKpiLabelStyle: React.CSSProperties = {
  color: palette.slate500,
  fontSize: "0.74rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailKpiValueStyle: React.CSSProperties = {
  color: palette.slate900,
  fontWeight: 800,
  fontSize: "0.95rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "8px",
};

const fieldGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: palette.slate500,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
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
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "4px",
};

const insightCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.indigoSoft}`,
  borderRadius: "20px",
  padding: "12px",
  background: palette.indigoSoft,
};

const insightTitleStyle: React.CSSProperties = {
  color: palette.indigoDark,
  fontSize: "0.88rem",
  fontWeight: 800,
};

const insightTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: palette.slate700,
  fontSize: "0.85rem",
};

const actionsCardStyle: React.CSSProperties = {
  border: `1px dashed ${palette.slate300}`,
  borderRadius: "20px",
  padding: "12px",
  background: palette.white,
};

const actionsTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  fontWeight: 800,
  color: palette.slate900,
};

const actionsListStyle: React.CSSProperties = {
  margin: "8px 0 0 16px",
  padding: 0,
  color: palette.slate700,
  fontSize: "0.84rem",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
};

const summaryCardStyle: React.CSSProperties = {
  border: `1px solid ${palette.slate200}`,
  background: palette.white,
  borderRadius: "20px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const summaryLabelStyle: React.CSSProperties = {
  color: palette.slate500,
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValueStyle: React.CSSProperties = {
  color: palette.slate900,
  fontSize: "1rem",
  fontWeight: 800,
};

const emptyStateStyle: React.CSSProperties = {
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
};

function getStatusBadgeStyle(status: ClientStatus): React.CSSProperties {
  if (status === "VIP") {
    return {
      ...baseBadgeStyle,
      background: "#ffedd5",
      color: "#9a3412",
    };
  }

  if (status === "Actif") {
    return {
      ...baseBadgeStyle,
      background: palette.mintSoft,
      color: palette.mintText,
    };
  }

  if (status === "A relancer") {
    return {
      ...baseBadgeStyle,
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    ...baseBadgeStyle,
    background: "#e2e8f0",
    color: "#475569",
  };
}

function getSourceBadgeStyle(source: ClientSource): React.CSSProperties {
  if (source === "Shopify") {
    return {
      ...baseBadgeStyle,
      background: palette.mintSoft,
      color: palette.mintText,
    };
  }

  if (source === "Amazon") {
    return {
      ...baseBadgeStyle,
      background: "#ffedd5",
      color: "#9a3412",
    };
  }

  return {
    ...baseBadgeStyle,
    background: palette.indigoSoft,
    color: palette.indigoDark,
  };
}

const baseBadgeStyle: React.CSSProperties = {
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "0.72rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
