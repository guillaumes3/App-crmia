"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, getClientsByOrganisation, type ClientRow, type ClientSource, type ClientStatus } from "@/app/services/clients";
import { supabase } from "@/app/utils/supabase";
import styles from "./clients.module.css";

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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);

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

        const orgId = session.user.user_metadata?.organisation_id as string | undefined;
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
      setShowCreateForm(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>CRM Clients</h1>
          <p>Suivez vos clients, priorisez les relances et creez de nouvelles fiches clients en base SQL.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setShowCreateForm((current) => !current)}>
            {showCreateForm ? "Fermer le formulaire" : "Nouveau client"}
          </button>
          <button type="button" className={styles.exportButton} onClick={handleExportCsv}>
            Exporter CSV
          </button>
        </div>
      </header>

      {showCreateForm ? (
        <section className={styles.createCard}>
          <div className={styles.createCardHeader}>
            <h2>Creation d un client</h2>
            <p>Le client sera enregistre dans la table SQL `clients` de votre organisation.</p>
          </div>

          <form className={styles.createForm} onSubmit={handleCreateClient}>
            <div className={styles.createGrid}>
              <label className={styles.inputGroup}>
                <span>Nom complet *</span>
                <input
                  required
                  value={formState.fullName}
                  onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Ex: Marie Curie"
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Email *</span>
                <input
                  required
                  type="email"
                  value={formState.email}
                  onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Ex: marie@email.fr"
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Telephone</span>
                <input
                  value={formState.phone}
                  onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Ex: +33 6 00 00 00 00"
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Segment</span>
                <input
                  value={formState.segment}
                  onChange={(event) => setFormState((current) => ({ ...current, segment: event.target.value }))}
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Source</span>
                <select
                  value={formState.source}
                  onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value as ClientSource }))}
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

              <label className={styles.inputGroup}>
                <span>Statut</span>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as ClientStatus }))}
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

              <label className={styles.inputGroup}>
                <span>Nombre de commandes</span>
                <input
                  type="number"
                  min={0}
                  value={formState.ordersCount}
                  onChange={(event) => setFormState((current) => ({ ...current, ordersCount: toNumber(event.target.value) }))}
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Panier moyen</span>
                <input
                  type="number"
                  min={0}
                  value={formState.averageBasket}
                  onChange={(event) => setFormState((current) => ({ ...current, averageBasket: toNumber(event.target.value) }))}
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Total depense</span>
                <input
                  type="number"
                  min={0}
                  value={formState.totalSpent}
                  onChange={(event) => setFormState((current) => ({ ...current, totalSpent: toNumber(event.target.value) }))}
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Dernier achat</span>
                <input
                  type="date"
                  value={formState.lastOrderDate}
                  onChange={(event) => setFormState((current) => ({ ...current, lastOrderDate: event.target.value }))}
                />
              </label>

              <label className={styles.inputGroup}>
                <span>Risque churn (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formState.churnRisk}
                  onChange={(event) => setFormState((current) => ({ ...current, churnRisk: clamp(toNumber(event.target.value), 0, 100) }))}
                />
              </label>
            </div>

            <label className={styles.inputGroup}>
              <span>Actions recommandees (une action par ligne)</span>
              <textarea
                rows={3}
                value={formState.nextActions}
                onChange={(event) => setFormState((current) => ({ ...current, nextActions: event.target.value }))}
                placeholder={"Proposer un bundle premium\nRelancer via email J+7"}
              />
            </label>

            {saveError ? <p className={styles.createError}>{saveError}</p> : null}

            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowCreateForm(false)}>
                Annuler
              </button>
              <button type="submit" className={styles.exportButton} disabled={saving}>
                {saving ? "Enregistrement..." : "Creer le client"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {loading ? <p className={styles.loadingState}>Chargement des clients...</p> : null}
      {loadingError ? <p className={styles.pageError}>{loadingError}</p> : null}

      {!loading && !loadingError ? (
        <>
          <section className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <span>Revenus clients</span>
              <strong>{formatEuros.format(kpis.totalRevenue)}</strong>
              <small>Sur la selection en cours</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Clients VIP</span>
              <strong>{kpis.vipClients}</strong>
              <small>Fort potentiel de recurrence</small>
            </article>
            <article className={styles.kpiCard}>
              <span>A recontacter</span>
              <strong>{kpis.toRevive}</strong>
              <small>Priorite retention</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Panier moyen</span>
              <strong>{formatEuros.format(kpis.avgBasket)}</strong>
              <small>Ticket moyen des clients filtres</small>
            </article>
          </section>

          <section className={styles.workspace}>
            <div className={styles.clientsPanel}>
              <div className={styles.toolbar}>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher nom ou email..."
                  className={styles.searchInput}
                  aria-label="Rechercher un client"
                />

                <div className={styles.filters}>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "Tous" | ClientStatus)}
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

              <div className={styles.tableContainer}>
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Statut</th>
                      <th>Source</th>
                      <th>Dernier achat</th>
                      <th>Total depense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={client.id === selectedClient?.id ? styles.selectedRow : ""}
                      >
                        <td>
                          <div className={styles.clientIdentity}>
                            <strong>{client.full_name}</strong>
                            <span>{client.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[statusClassName(client.status)]}`}>{client.status}</span>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[sourceClassName(client.source)]}`}>{client.source}</span>
                        </td>
                        <td>{formatDate(client.last_order_date)}</td>
                        <td className={styles.money}>{formatEuros.format(toNumber(client.total_spent))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredClients.length === 0 ? (
                  <p className={styles.emptyState}>Aucun client ne correspond aux filtres appliques.</p>
                ) : null}
              </div>
            </div>

            <aside className={styles.detailPanel}>
              {selectedClient ? (
                <>
                  <div className={styles.detailHeader}>
                    <h2>{selectedClient.full_name}</h2>
                    <span className={`${styles.badge} ${styles[statusClassName(selectedClient.status)]}`}>{selectedClient.status}</span>
                  </div>

                  <p className={styles.detailMeta}>
                    {selectedClient.email}
                    <br />
                    {selectedClient.phone || "Telephone non renseigne"}
                  </p>

                  <div className={styles.detailGrid}>
                    <div>
                      <span>Segment</span>
                      <strong>{selectedClient.segment || "Non defini"}</strong>
                    </div>
                    <div>
                      <span>Commandes</span>
                      <strong>{toNumber(selectedClient.orders_count)}</strong>
                    </div>
                    <div>
                      <span>Panier moyen</span>
                      <strong>{formatEuros.format(toNumber(selectedClient.average_basket))}</strong>
                    </div>
                    <div>
                      <span>Risque de churn</span>
                      <strong>{Math.round(toNumber(selectedClient.churn_risk))}%</strong>
                    </div>
                  </div>

                  <div className={styles.actionsBox}>
                    <h3>Actions recommandees</h3>
                    <ul>
                      {(selectedClient.next_actions && selectedClient.next_actions.length > 0
                        ? selectedClient.next_actions
                        : ["Aucune action definie pour ce client."]
                      ).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className={styles.emptyState}>Selectionnez un client pour voir les details.</p>
              )}
            </aside>
          </section>

          <section className={styles.aiInsight}>
            <strong>Insight IA</strong>
            <p>
              {filteredClients.filter((client) => client.status === "VIP" && client.source === "Shopify").length > 0
                ? "Le segment VIP Shopify reste le plus rentable. Une campagne de cross sell est recommandee."
                : "Aucun VIP Shopify detecte. Priorisez une campagne de conversion sur les clients Actifs."}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function statusClassName(status: ClientStatus): string {
  if (status === "VIP") return "statusVip";
  if (status === "Actif") return "statusActive";
  if (status === "A relancer") return "statusToFollow";
  return "statusInactive";
}

function sourceClassName(source: ClientSource): string {
  if (source === "Shopify") return "sourceShopify";
  if (source === "Amazon") return "sourceAmazon";
  return "sourceSite";
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
