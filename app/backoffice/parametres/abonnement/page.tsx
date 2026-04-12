"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/utils/supabase";

interface InvoiceRow {
  id: string;
  amount_ttc: number | null;
  due_date: string | null;
  status: string | null;
  period_start: string | null;
  period_end: string | null;
}

interface OfferDraft {
  plan: string;
  echeance: string;
}

const initialOfferDraft: OfferDraft = {
  plan: "STARTER",
  echeance: "",
};

export default function AbonnementPage() {
  const [orgId, setOrgId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [updatingInvoice, setUpdatingInvoice] = useState(false);
  const [invoiceList, setInvoiceList] = useState<InvoiceRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(initialOfferDraft);

  const loadData = useCallback(async (id: string) => {
    setLoadingList(true);

    const [invoiceResponse, orgResponse] = await Promise.all([
      supabase
        .from("billing_invoices")
        .select("id, amount_ttc, due_date, status, period_start, period_end")
        .eq("organisation_id", id)
        .order("due_date", { ascending: false }),
      supabase.from("organisations").select("plan, trial_ends_at").eq("id", id).single(),
    ]);

    if (invoiceResponse.error != null) {
      alert(invoiceResponse.error.message);
      setLoadingList(false);
      return;
    }

    if (orgResponse.error != null) {
      alert(orgResponse.error.message);
      setLoadingList(false);
      return;
    }

    setInvoiceList((invoiceResponse.data ?? []) as InvoiceRow[]);

    const orgRow = orgResponse.data as { plan: string | null; trial_ends_at: string | null };
    setOfferDraft({
      plan: orgRow.plan ?? "STARTER",
      echeance: orgRow.trial_ends_at ? orgRow.trial_ends_at.slice(0, 10) : "",
    });

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

  const selectedInvoice = useMemo(() => {
    if (selectedItem == null || selectedItem === "offer") {
      return null;
    }

    return invoiceList.find((invoice) => invoice.id === selectedItem) ?? null;
  }, [invoiceList, selectedItem]);

  const selectOffer = () => {
    setSelectedItem("offer");
    setActiveMenu(null);
  };

  const selectInvoice = (invoice: InvoiceRow) => {
    setSelectedItem(invoice.id);
    setActiveMenu(null);
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (orgId.length === 0) {
      alert("Organisation introuvable.");
      return;
    }

    setSavingOffer(true);

    const updateResponse = await supabase
      .from("organisations")
      .update({
        plan: offerDraft.plan,
        trial_ends_at: offerDraft.echeance.length > 0 ? offerDraft.echeance : null,
      })
      .eq("id", orgId);

    if (updateResponse.error != null) {
      alert(updateResponse.error.message);
      setSavingOffer(false);
      return;
    }

    await loadData(orgId);
    setSavingOffer(false);
  };

  const updateInvoiceStatus = async (invoiceId: string, nextStatus: "paid" | "pending") => {
    if (orgId.length === 0) {
      return;
    }

    setUpdatingInvoice(true);

    const payload: Record<string, unknown> = {
      status: nextStatus,
      paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
    };

    const updateResponse = await supabase
      .from("billing_invoices")
      .update(payload)
      .eq("id", invoiceId)
      .eq("organisation_id", orgId);

    if (updateResponse.error != null) {
      alert(updateResponse.error.message);
      setUpdatingInvoice(false);
      return;
    }

    await loadData(orgId);
    setUpdatingInvoice(false);
    setActiveMenu(null);
  };

  return (
    <div style={splitLayout}>
      <section style={leftPane}>
        <div style={viewCard}>
          <header style={cardHeaderRow}>
            <div>
              <h2 style={cardTitle}>Abonnement</h2>
              <p style={cardSubtitle}>Historique des factures et actions rapides.</p>
            </div>
            <button type="button" style={primaryButton} onClick={selectOffer}>
              + Ajouter
            </button>
          </header>

          {loadingList ? (
            <p style={helperText}>Chargement des factures...</p>
          ) : invoiceList.length === 0 ? (
            <p style={helperText}>Aucune facture passee pour le moment.</p>
          ) : (
            <div style={itemStack}>
              {invoiceList.map((invoice) => {
                const isActive = selectedItem === invoice.id;
                return (
                  <article key={invoice.id} style={listItemStyle(isActive)}>
                    <button type="button" style={itemContentButton} onClick={() => selectInvoice(invoice)}>
                      <span style={itemTextWrap}>
                        <strong style={itemTitle}>Facture #{invoice.id.slice(0, 8).toUpperCase()}</strong>
                        <span style={itemDescription}>Echeance: {formatDate(invoice.due_date)}</span>
                      </span>
                      <span style={statusBadge(invoice.status ?? "pending")}>{invoice.status ?? "pending"}</span>
                    </button>

                    <div style={menuWrap}>
                      <button
                        type="button"
                        style={burgerButton}
                        onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                      >
                        ⋮
                      </button>

                      {activeMenu === invoice.id ? (
                        <div style={dropdownMenu}>
                          <button type="button" style={dropdownButton} onClick={() => selectInvoice(invoice)}>
                            Voir details
                          </button>
                          <button type="button" style={dropdownButton} onClick={selectOffer}>
                            Voir l offre
                          </button>
                          {invoice.status === "paid" ? (
                            <button
                              type="button"
                              style={dropdownButton}
                              onClick={() => updateInvoiceStatus(invoice.id, "pending")}
                              disabled={updatingInvoice}
                            >
                              Remettre en attente
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={dropdownButton}
                              onClick={() => updateInvoiceStatus(invoice.id, "paid")}
                              disabled={updatingInvoice}
                            >
                              Marquer payee
                            </button>
                          )}
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
            <form style={formWrap} onSubmit={saveOffer}>
              <header style={formHeader}>
                <h3 style={formTitle}>Offre actuelle</h3>
                <span style={chipInfo}>Edition</span>
              </header>

              {selectedInvoice != null ? (
                <div style={invoiceSummaryCard}>
                  <p style={summaryLine}>
                    <strong>Facture:</strong> #{selectedInvoice.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p style={summaryLine}>
                    <strong>Periode:</strong> {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                  </p>
                  <p style={summaryLine}>
                    <strong>Montant TTC:</strong> {formatCurrency(selectedInvoice.amount_ttc)}
                  </p>
                  <p style={summaryLine}>
                    <strong>Statut:</strong> {selectedInvoice.status ?? "pending"}
                  </p>
                </div>
              ) : null}

              <label style={fieldLabel} htmlFor="offer-plan">
                Plan
              </label>
              <select
                id="offer-plan"
                style={fieldInput}
                value={offerDraft.plan}
                onChange={(event) => setOfferDraft((current) => ({ ...current, plan: event.target.value }))}
              >
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>

              <label style={fieldLabel} htmlFor="offer-end-date">
                Date d echeance
              </label>
              <input
                id="offer-end-date"
                style={fieldInput}
                type="date"
                value={offerDraft.echeance}
                onChange={(event) => setOfferDraft((current) => ({ ...current, echeance: event.target.value }))}
              />

              <div style={actionsRow}>
                <button type="button" style={ghostButton} onClick={() => setSelectedItem(null)}>
                  Annuler
                </button>
                <button type="submit" style={submitButton} disabled={savingOffer}>
                  {savingOffer ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(input: string | null): string {
  if (input == null || input.length === 0) {
    return "-";
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatCurrency(value: number | null): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
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

const statusBadge = (status: string): React.CSSProperties => ({
  background: status === "paid" ? "#dcfce7" : status === "overdue" ? "#fee2e2" : "#e0e7ff",
  color: status === "paid" ? "#166534" : status === "overdue" ? "#991b1b" : "#3730a3",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 800,
  padding: "4px 10px",
  whiteSpace: "nowrap",
  textTransform: "uppercase",
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
  minWidth: "170px",
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

const invoiceSummaryCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "8px",
};

const summaryLine: React.CSSProperties = {
  margin: "4px 0",
  color: "#334155",
  fontSize: "0.84rem",
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
