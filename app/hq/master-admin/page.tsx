"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";
import {
  PLAN_PRICES,
  clearTemporaryAccessCode,
  createBillingInvoice,
  fetchBillingInvoices,
  fetchOrganisations,
  fetchPlatformVolumes,
  markInvoiceAsPending,
  markInvoiceAsPaid,
  removeOrganisation,
  requestTemporaryAccessCode,
  sendOrganisationAdminInvite,
  updateOrganisationMaintenance,
  updateOrganisationOwner,
  updateOrganisationPlan,
  updateOrganisationStatus,
  type BillingInvoiceRow,
  type OrganisationRow,
  type OrganisationStatus,
  type PlanCode,
  type PlatformVolume,
} from "@/app/services/master-admin";
import styles from "./page.module.css";

type ActivityLevel = "info" | "success" | "warning";
type ActiveTab = "pilotage" | "facturation" | "acces";

type ActivityItem = {
  id: string;
  message: string;
  at: Date;
  level: ActivityLevel;
};

type AccessModalState = {
  org: OrganisationRow;
  code: string;
} | null;

type InvoiceFormState = {
  organisationId: string;
  customAmount: string;
  taxRate: string;
  dueInDays: string;
};

type AccessFormState = {
  organisationId: string;
  ownerName: string;
  ownerEmail: string;
};

const PLAN_OPTIONS: PlanCode[] = ["STARTER", "PRO", "ENTERPRISE"];

export default function MasterAdminPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("pilotage");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [organisations, setOrganisations] = useState<OrganisationRow[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([]);
  const [platformVolume, setPlatformVolume] = useState<PlatformVolume>({
    clients: null,
    produits: null,
    profiles: null,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const [accessModal, setAccessModal] = useState<AccessModalState>(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>({
    organisationId: "",
    customAmount: "",
    taxRate: "20",
    dueInDays: "15",
  });

  const [accessForm, setAccessForm] = useState<AccessFormState>({
    organisationId: "",
    ownerName: "",
    ownerEmail: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [orgRows, invoiceRows, volumeRows] = await Promise.all([
          fetchOrganisations(),
          fetchBillingInvoices().catch(() => []),
          fetchPlatformVolumes(),
        ]);

        if (!isMounted) return;
        setOrganisations(orgRows);
        setInvoices(invoiceRows);
        setPlatformVolume(volumeRows);

        if (orgRows.length > 0) {
          setInvoiceForm((current) => ({
            ...current,
            organisationId: current.organisationId || orgRows[0].id,
          }));
          setAccessForm((current) => ({
            ...current,
            organisationId: current.organisationId || orgRows[0].id,
          }));
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const orgChannel = supabase
      .channel("master-admin-organisations")
      .on("postgres_changes", { event: "*", schema: "public", table: "organisations" }, async (payload) => {
        if (!isMounted) return;
        await refreshOrganisations(isMounted, setOrganisations);

        const newRow = extractNameFromPayload(payload.new);
        if (payload.eventType === "INSERT" && newRow) {
          addActivity(setActivities, {
            message: `Nouvelle entreprise enregistree: ${newRow}`,
            level: "success",
          });
        }
      })
      .subscribe();

    const invoiceChannel = supabase
      .channel("master-admin-billing")
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_invoices" }, async () => {
        if (!isMounted) return;
        await refreshInvoices(isMounted, setInvoices);
      })
      .subscribe();

    void loadData();

    return () => {
      isMounted = false;
      supabase.removeChannel(orgChannel);
      supabase.removeChannel(invoiceChannel);
    };
  }, []);

  const filteredOrgs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return organisations;

    return organisations.filter((org) => {
      const values = [org.nom, org.owner_email, org.billing_email, org.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return values.includes(normalized);
    });
  }, [organisations, search]);

  const planDistribution = useMemo(() => {
    return PLAN_OPTIONS.map((plan) => ({
      plan,
      count: organisations.filter((org) => normalizePlan(org.plan) === plan).length,
    }));
  }, [organisations]);

  const analytics = useMemo(() => {
    const activeCount = organisations.filter((org) => normalizeStatus(org.statut) === "actif").length;
    const maintenanceCount = organisations.filter((org) => org.maintenance_mode).length;
    const newLast30Days = organisations.filter((org) => isInLastDays(org.created_at, 30)).length;
    const monthlyRecurringRevenue = organisations
      .filter((org) => normalizeStatus(org.statut) === "actif")
      .reduce((sum, org) => {
        const plan = normalizePlan(org.plan);
        const seats = Math.max(1, org.seat_count ?? 1);
        return sum + PLAN_PRICES[plan] * seats;
      }, 0);

    const suspendedCount = organisations.length - activeCount;
    const suspensionRate = organisations.length > 0 ? (suspendedCount / organisations.length) * 100 : 0;
    const pendingInvoices = invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "overdue");
    const pendingAmount = pendingInvoices.reduce((sum, invoice) => sum + toNumber(invoice.amount_ttc), 0);
    const paidAmount = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + toNumber(invoice.amount_ttc), 0);

    return {
      activeCount,
      maintenanceCount,
      newLast30Days,
      monthlyRecurringRevenue,
      suspensionRate,
      pendingInvoices: pendingInvoices.length,
      pendingAmount,
      paidAmount,
    };
  }, [invoices, organisations]);

  const selectedInvoiceOrg = useMemo(
    () => organisations.find((org) => org.id === invoiceForm.organisationId) ?? null,
    [invoiceForm.organisationId, organisations],
  );

  const suggestedInvoiceAmount = selectedInvoiceOrg
    ? PLAN_PRICES[normalizePlan(selectedInvoiceOrg.plan)] * Math.max(1, selectedInvoiceOrg.seat_count ?? 1)
    : 0;

  const clearMessages = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const handlePlanChange = async (org: OrganisationRow, plan: PlanCode) => {
    clearMessages();
    try {
      await updateOrganisationPlan(org.id, plan);
      setOrganisations((current) => current.map((row) => (row.id === org.id ? { ...row, plan } : row)));
      setActionSuccess(`Plan mis a jour pour ${org.nom}.`);
    } catch (updateError) {
      setActionError(getErrorMessage(updateError));
    }
  };

  const handleStatusToggle = async (org: OrganisationRow) => {
    clearMessages();
    const nextStatus: OrganisationStatus = normalizeStatus(org.statut) === "suspendu" ? "actif" : "suspendu";

    try {
      await updateOrganisationStatus(org.id, nextStatus);
      setOrganisations((current) => current.map((row) => (row.id === org.id ? { ...row, statut: nextStatus } : row)));
      setActionSuccess(`Statut mis a jour pour ${org.nom}.`);
    } catch (toggleError) {
      setActionError(getErrorMessage(toggleError));
    }
  };

  const handleMaintenanceToggle = async (org: OrganisationRow) => {
    clearMessages();
    const nextMaintenance = !org.maintenance_mode;

    try {
      await updateOrganisationMaintenance(org.id, nextMaintenance);
      setOrganisations((current) =>
        current.map((row) => (row.id === org.id ? { ...row, maintenance_mode: nextMaintenance } : row)),
      );
      setActionSuccess(`Mode maintenance ${nextMaintenance ? "active" : "desactive"} pour ${org.nom}.`);
    } catch (maintenanceError) {
      setActionError(getErrorMessage(maintenanceError));
    }
  };

  const handleDeleteOrganisation = async (org: OrganisationRow) => {
    clearMessages();
    const confirmed = window.confirm(
      `Supprimer definitivement "${org.nom}" ?\nCette action supprimera aussi ses donnees rattachees.`,
    );
    if (!confirmed) return;

    try {
      await removeOrganisation(org.id);
      setOrganisations((current) => current.filter((row) => row.id !== org.id));
      setActionSuccess(`${org.nom} a ete supprimee.`);
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError));
    }
  };

  const handleRequestMaintenanceAccess = async (org: OrganisationRow) => {
    clearMessages();
    try {
      const generatedCode = await requestTemporaryAccessCode(org.id);
      setAccessModal({ org, code: generatedCode });
      setAccessCodeInput("");
    } catch (accessError) {
      setActionError(getErrorMessage(accessError));
    }
  };

  const handleConfirmMaintenanceAccess = async () => {
    if (!accessModal) return;
    if (accessCodeInput !== accessModal.code) {
      setActionError("Code invalide. Verifiez le code transmis par l entreprise.");
      return;
    }

    clearMessages();
    try {
      localStorage.setItem("impersonated_org_id", accessModal.org.id);
      localStorage.setItem("maintenance_override", "1");
      localStorage.setItem("maintenance_org_id", accessModal.org.id);
      await clearTemporaryAccessCode(accessModal.org.id);
      setAccessModal(null);
      router.push("/backoffice/dashboard");
    } catch (confirmError) {
      setActionError(getErrorMessage(confirmError));
    }
  };

  const handleCreateInvoice = async () => {
    clearMessages();
    if (!invoiceForm.organisationId) {
      setActionError("Selectionnez une organisation pour facturer.");
      return;
    }

    const amountHt = toNumber(invoiceForm.customAmount) > 0 ? toNumber(invoiceForm.customAmount) : suggestedInvoiceAmount;
    if (amountHt <= 0) {
      setActionError("Le montant de la facture doit etre superieur a 0.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.max(1, toNumber(invoiceForm.dueInDays)));

      const invoice = await createBillingInvoice({
        organisationId: invoiceForm.organisationId,
        amountHt,
        taxRate: toNumber(invoiceForm.taxRate) || 20,
        periodStart: toIsoDate(periodStart),
        periodEnd: toIsoDate(periodEnd),
        dueDate: toIsoDate(dueDate),
      });

      setInvoices((current) => [invoice, ...current]);
      setActionSuccess("Facture creee avec succes.");
      addActivity(setActivities, {
        message: `Nouvelle facture creee pour ${resolveOrgName(invoice.organisation_id, organisations)}.`,
        level: "info",
      });
    } catch (invoiceError) {
      setActionError(getErrorMessage(invoiceError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    clearMessages();
    try {
      await markInvoiceAsPaid(invoiceId);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, status: "paid", paid_at: new Date().toISOString() } : invoice,
        ),
      );
      setActionSuccess("Facture marquee comme payee.");
    } catch (paidError) {
      setActionError(getErrorMessage(paidError));
    }
  };

  const handleRevertInvoicePaid = async (invoiceId: string) => {
    clearMessages();
    try {
      await markInvoiceAsPending(invoiceId);
      setInvoices((current) =>
        current.map((invoice) => (invoice.id === invoiceId ? { ...invoice, status: "pending", paid_at: null } : invoice)),
      );
      setActionSuccess("Le statut de la facture a ete remis en attente.");
    } catch (revertError) {
      setActionError(getErrorMessage(revertError));
    }
  };

  const handleGenerateInvoicePdf = (invoice: BillingInvoiceRow) => {
    clearMessages();
    const org = organisations.find((item) => item.id === invoice.organisation_id);
    const orgName = org?.nom ?? "Entreprise";
    const billingEmail = org?.billing_email ?? org?.owner_email ?? "-";
    const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
    const generatedDate = new Date().toLocaleDateString("fr-FR");

    const amountHt = toNumber(invoice.amount_ht);
    const amountTtc = toNumber(invoice.amount_ttc);
    const taxRate = toNumber(invoice.tax_rate);
    const taxAmount = amountTtc - amountHt;

    const html = `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoiceNumber)} - Facture</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 28px; color: #111827; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; }
      .brand { font-size: 26px; font-weight: 800; letter-spacing: 0.2px; }
      .meta { text-align: right; font-size: 12px; color: #374151; }
      .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
      .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }
      .value { margin-top: 4px; font-size: 14px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; font-size: 13px; }
      th { color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; }
      .right { text-align: right; }
      .total { margin-top: 12px; margin-left: auto; width: 280px; }
      .totalRow { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
      .totalMain { border-top: 1px solid #111827; margin-top: 5px; padding-top: 8px; font-weight: 800; font-size: 16px; }
      .footer { margin-top: 24px; color: #6b7280; font-size: 11px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">Kipilote</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Facturation multi-entreprise</div>
      </div>
      <div class="meta">
        <div><strong>Facture:</strong> ${escapeHtml(invoiceNumber)}</div>
        <div><strong>Date:</strong> ${escapeHtml(generatedDate)}</div>
        <div><strong>Echeance:</strong> ${escapeHtml(formatDate(invoice.due_date))}</div>
      </div>
    </div>

    <div class="card">
      <div class="label">Facture a</div>
      <div class="value">${escapeHtml(orgName)}</div>
      <div style="font-size:12px;color:#374151;margin-top:3px;">${escapeHtml(billingEmail)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Periode</th>
          <th class="right">Montant HT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Abonnement ${escapeHtml(normalizePlan(org?.plan ?? "STARTER"))}</td>
          <td>${escapeHtml(formatDate(invoice.period_start))} - ${escapeHtml(formatDate(invoice.period_end))}</td>
          <td class="right">${escapeHtml(formatCurrency(amountHt))}</td>
        </tr>
      </tbody>
    </table>

    <div class="total">
      <div class="totalRow"><span>Montant HT</span><strong>${escapeHtml(formatCurrency(amountHt))}</strong></div>
      <div class="totalRow"><span>TVA (${escapeHtml(String(taxRate))}%)</span><strong>${escapeHtml(formatCurrency(taxAmount))}</strong></div>
      <div class="totalRow totalMain"><span>Total TTC</span><strong>${escapeHtml(formatCurrency(amountTtc))}</strong></div>
    </div>

    <div class="footer">
      Ce document est genere depuis le panneau master admin. Utilisez "Imprimer" puis "Enregistrer en PDF".
    </div>
  </body>
</html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=780");
    if (!printWindow) {
      setActionError("Impossible d'ouvrir la fenetre PDF. Autorisez les popups puis reessayez.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 220);
  };

  const handleCreateEnterpriseAccess = async () => {
    clearMessages();
    if (!accessForm.organisationId || !accessForm.ownerEmail || !accessForm.ownerName) {
      setActionError("Renseignez l organisation, le nom du proprietaire et l email.");
      return;
    }

    setIsSaving(true);
    try {
      await sendOrganisationAdminInvite({
        email: accessForm.ownerEmail,
        organisationId: accessForm.organisationId,
        ownerName: accessForm.ownerName,
      });

      await updateOrganisationOwner(accessForm.organisationId, {
        ownerName: accessForm.ownerName,
        ownerEmail: accessForm.ownerEmail,
        billingEmail: accessForm.ownerEmail,
      });

      setOrganisations((current) =>
        current.map((org) =>
          org.id === accessForm.organisationId
            ? {
                ...org,
                owner_name: accessForm.ownerName,
                owner_email: accessForm.ownerEmail,
                billing_email: accessForm.ownerEmail,
              }
            : org,
        ),
      );

      setActionSuccess("Acces entreprise global envoye. Le proprietaire peut maintenant creer ses collaborateurs.");
      addActivity(setActivities, {
        message: `Invitation administrateur envoyee a ${accessForm.ownerEmail}.`,
        level: "success",
      });
    } catch (inviteError) {
      setActionError(getErrorMessage(inviteError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Pilotage Multi-Entreprise</h1>
          <p>Administration centralisee, maintenance, analytics globales, facturation et gestion des acces entreprises.</p>
        </div>
        <div className={styles.searchBox}>
          <input
            type="search"
            placeholder="Rechercher une entreprise, email ou ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </header>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>MRR estime</span>
          <strong>{formatCurrency(analytics.monthlyRecurringRevenue)}</strong>
          <small>Recurrence mensuelle active</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Entreprises actives</span>
          <strong>{analytics.activeCount}</strong>
          <small>Sur {organisations.length} entreprises</small>
        </article>
        <article className={styles.kpiCard}>
          <span>En maintenance</span>
          <strong>{analytics.maintenanceCount}</strong>
          <small>Instances temporairement bloquees</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Nouvelles (30 jours)</span>
          <strong>{analytics.newLast30Days}</strong>
          <small>Acquisition recente</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Factures en attente</span>
          <strong>{analytics.pendingInvoices}</strong>
          <small>{formatCurrency(analytics.pendingAmount)} a recouvrer</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Taux de suspension</span>
          <strong>{analytics.suspensionRate.toFixed(1)}%</strong>
          <small>Controle de la qualite locataire</small>
        </article>
      </section>

      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === "pilotage" ? styles.activeTabButton : styles.tabButton}
          onClick={() => setActiveTab("pilotage")}
        >
          Pilotage
        </button>
        <button
          type="button"
          className={activeTab === "facturation" ? styles.activeTabButton : styles.tabButton}
          onClick={() => setActiveTab("facturation")}
        >
          Facturation
        </button>
        <button
          type="button"
          className={activeTab === "acces" ? styles.activeTabButton : styles.tabButton}
          onClick={() => setActiveTab("acces")}
        >
          Acces entreprise
        </button>
      </div>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {actionError ? <p className={styles.errorBanner}>{actionError}</p> : null}
      {actionSuccess ? <p className={styles.successBanner}>{actionSuccess}</p> : null}
      {loading ? <p className={styles.loadingBanner}>Chargement des donnees administrateur...</p> : null}

      {!loading && activeTab === "pilotage" ? (
        <section className={styles.mainGrid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Entreprises deployees</h2>
              <p>{filteredOrgs.length} resultats</p>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Plan</th>
                    <th>Statut</th>
                    <th>Maintenance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <div className={styles.orgIdentity}>
                          <strong>{org.nom}</strong>
                          <span>{org.owner_email || "owner non defini"} - {org.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          value={normalizePlan(org.plan)}
                          onChange={(event) => handlePlanChange(org, event.target.value as PlanCode)}
                        >
                          {PLAN_OPTIONS.map((plan) => (
                            <option key={plan} value={plan}>
                              {plan}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={normalizeStatus(org.statut) === "suspendu" ? styles.badgeDanger : styles.badgeSuccess}
                          onClick={() => handleStatusToggle(org)}
                        >
                          {normalizeStatus(org.statut)}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={org.maintenance_mode ? styles.badgeWarning : styles.badgeMuted}
                          onClick={() => handleMaintenanceToggle(org)}
                        >
                          {org.maintenance_mode ? "active" : "inactive"}
                        </button>
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button type="button" onClick={() => handleRequestMaintenanceAccess(org)}>
                            Entrer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceForm((current) => ({ ...current, organisationId: org.id }));
                              setActiveTab("facturation");
                            }}
                          >
                            Facturer
                          </button>
                          <button type="button" className={styles.buttonDanger} onClick={() => handleDeleteOrganisation(org)}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className={styles.sideColumn}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Analyse plateforme</h3>
              </div>
              <div className={styles.statList}>
                <div>
                  <span>Clients total</span>
                  <strong>{platformVolume.clients ?? "-"}</strong>
                </div>
                <div>
                  <span>Produits total</span>
                  <strong>{platformVolume.produits ?? "-"}</strong>
                </div>
                <div>
                  <span>Collaborateurs total</span>
                  <strong>{platformVolume.profiles ?? "-"}</strong>
                </div>
                <div>
                  <span>Encaissement cumule</span>
                  <strong>{formatCurrency(analytics.paidAmount)}</strong>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Repartition des plans</h3>
              </div>
              <div className={styles.distribution}>
                {planDistribution.map((item) => {
                  const ratio = organisations.length > 0 ? (item.count / organisations.length) * 100 : 0;
                  return (
                    <div key={item.plan}>
                      <div className={styles.distributionLabel}>
                        <span>{item.plan}</span>
                        <strong>{item.count}</strong>
                      </div>
                      <div className={styles.distributionBar}>
                        <span style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>Historique live</h3>
              </div>
              {activities.length === 0 ? (
                <p className={styles.emptyState}>Aucune activite recente.</p>
              ) : (
                <ul className={styles.activityList}>
                  {activities.map((item) => (
                    <li key={item.id}>
                      <span className={`${styles.activityDot} ${styles[`activity${capitalize(item.level)}`]}`} />
                      <div>
                        <strong>{item.message}</strong>
                        <small>{item.at.toLocaleString("fr-FR")}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </aside>
        </section>
      ) : null}

      {!loading && activeTab === "facturation" ? (
        <section className={styles.billingGrid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Creer une facture</h2>
              <p>Facturation B2B multi-entreprise</p>
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Organisation</span>
                <select
                  value={invoiceForm.organisationId}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, organisationId: event.target.value }))}
                >
                  {organisations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Montant HT</span>
                <input
                  type="number"
                  min={0}
                  value={invoiceForm.customAmount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, customAmount: event.target.value }))}
                  placeholder={String(suggestedInvoiceAmount)}
                />
              </label>
              <label>
                <span>Taux TVA</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={invoiceForm.taxRate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))}
                />
              </label>
              <label>
                <span>Echeance (jours)</span>
                <input
                  type="number"
                  min={1}
                  value={invoiceForm.dueInDays}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, dueInDays: event.target.value }))}
                />
              </label>
            </div>

            <div className={styles.inlineInfo}>
              <p>
                Montant recommande selon le plan:
                <strong> {formatCurrency(suggestedInvoiceAmount)}</strong>
              </p>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={handleCreateInvoice} disabled={isSaving}>
                {isSaving ? "Traitement..." : "Generer la facture"}
              </button>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Journal de facturation</h2>
              <p>{invoices.length} factures</p>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Montant TTC</th>
                    <th>Statut</th>
                    <th>Echeance</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{resolveOrgName(invoice.organisation_id, organisations)}</td>
                      <td>{formatCurrency(toNumber(invoice.amount_ttc))}</td>
                      <td>
                        <span className={invoice.status === "paid" ? styles.badgeSuccess : styles.badgeWarning}>{invoice.status}</span>
                      </td>
                      <td>{formatDate(invoice.due_date)}</td>
                      <td>
                        <div className={styles.invoiceActionRow}>
                          <button type="button" onClick={() => handleGenerateInvoicePdf(invoice)}>
                            PDF
                          </button>
                          {invoice.status !== "paid" ? (
                            <button type="button" onClick={() => handleMarkInvoicePaid(invoice.id)}>
                              Marquer payee
                            </button>
                          ) : (
                            <button type="button" onClick={() => handleRevertInvoicePaid(invoice.id)}>
                              Annuler paiement
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {!loading && activeTab === "acces" ? (
        <section className={styles.accessGrid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Creer un acces entreprise global</h2>
              <p>Envoie une invitation administrateur pour piloter ensuite les acces collaborateurs.</p>
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Organisation</span>
                <select
                  value={accessForm.organisationId}
                  onChange={(event) => setAccessForm((current) => ({ ...current, organisationId: event.target.value }))}
                >
                  {organisations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nom du proprietaire</span>
                <input
                  value={accessForm.ownerName}
                  onChange={(event) => setAccessForm((current) => ({ ...current, ownerName: event.target.value }))}
                  placeholder="Ex: Sarah Martin"
                />
              </label>
              <label>
                <span>Email du proprietaire</span>
                <input
                  type="email"
                  value={accessForm.ownerEmail}
                  onChange={(event) => setAccessForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                  placeholder="owner@entreprise.com"
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={handleCreateEnterpriseAccess} disabled={isSaving}>
                {isSaving ? "Traitement..." : "Envoyer l acces global"}
              </button>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Checklist d exploitation multi-entreprise</h2>
            </div>
            <ul className={styles.checklist}>
              <li>Provisioning d une organisation et attribution d un plan.</li>
              <li>Activation d un administrateur entreprise (acces global).</li>
              <li>Gestion des collaborateurs depuis Parametres entreprise.</li>
              <li>Mode maintenance pilotable depuis master admin.</li>
              <li>Facturation periodique et suivi des encaissements.</li>
              <li>Monitoring global des volumes (clients, produits, profils).</li>
            </ul>
          </article>
        </section>
      ) : null}

      {accessModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Verification d acces maintenance</h2>
            <p>
              Saisissez le code de verification transmis par l entreprise <strong>{accessModal.org.nom}</strong>.
            </p>
            <input
              maxLength={6}
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value)}
              placeholder="000000"
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setAccessModal(null)}>
                Annuler
              </button>
              <button type="button" onClick={handleConfirmMaintenanceAccess}>
                Entrer en maintenance
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function refreshOrganisations(
  isMounted: boolean,
  setOrganisations: React.Dispatch<React.SetStateAction<OrganisationRow[]>>,
): Promise<void> {
  try {
    const rows = await fetchOrganisations();
    if (isMounted) setOrganisations(rows);
  } catch {
    // Ignore realtime refresh errors, full refresh keeps primary UX stable
  }
}

async function refreshInvoices(
  isMounted: boolean,
  setInvoices: React.Dispatch<React.SetStateAction<BillingInvoiceRow[]>>,
): Promise<void> {
  try {
    const rows = await fetchBillingInvoices();
    if (isMounted) setInvoices(rows);
  } catch {
    // Ignore realtime refresh errors, full refresh keeps primary UX stable
  }
}

function addActivity(
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>,
  payload: { message: string; level: ActivityLevel },
): void {
  setActivities((current) => [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message: payload.message,
      at: new Date(),
      level: payload.level,
    },
    ...current.slice(0, 24),
  ]);
}

function extractNameFromPayload(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row.nom === "string" ? row.nom : null;
}

function normalizePlan(value: string | null): PlanCode {
  if (value === "PRO" || value === "ENTERPRISE") return value;
  return "STARTER";
}

function normalizeStatus(value: string | null): OrganisationStatus {
  if (value === "suspendu") return "suspendu";
  return "actif";
}

function resolveOrgName(orgId: string, organisations: OrganisationRow[]): string {
  return organisations.find((org) => org.id === orgId)?.nom ?? orgId.slice(0, 8);
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
}

function isInLastDays(value: string | null, days: number): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Une erreur est survenue.";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
