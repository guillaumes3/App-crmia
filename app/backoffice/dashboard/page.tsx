"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabase";
import { getDashboardStats } from "@/app/services/stats";
import { getOrganisationId, isKipiloteStaff } from "@/app/types/auth";
import { setActiveUniverse } from "@/app/utils/universeState";

type DashboardStats = {
  nbProduits?: number | null;
  valeurStock?: number | string | null;
  nbVentes?: number | null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isInfiltration, setIsInfiltration] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      if (isKipiloteStaff(session.user)) {
        setActiveUniverse("hq");
        if (typeof window !== "undefined") {
          window.location.assign("/hq/staff");
        }
        return;
      }

      setActiveUniverse("client");
      setUser(session.user);
      setIsInfiltration(false);

      const organisationId = getOrganisationId(session.user);
      if (!organisationId) return;

      const data = await getDashboardStats(organisationId);
      setStats(data as DashboardStats);
    };

    void loadData();
  }, []);

  const kpis = useMemo(() => {
    const products = Number(stats?.nbProduits ?? 0);
    const sales = Number(stats?.nbVentes ?? 0);
    const stockValue = Number(stats?.valeurStock ?? 0);
    const avgTicket = sales > 0 ? stockValue / sales : 0;
    return { products, sales, stockValue, avgTicket };
  }, [stats]);

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Tableau de bord</h1>
          <p style={pageSubtitleStyle}>
            {isInfiltration ? "Mode maintenance expert" : `Ravi de vous revoir, ${user?.user_metadata?.nom || "Gerant"}`}
          </p>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Articles</span>
          <strong style={kpiValueStyle}>{kpis.products}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Valeur stock</span>
          <strong style={kpiValueStyle}>{currencyFormatter.format(kpis.stockValue)}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Transactions</span>
          <strong style={kpiValueStyle}>{kpis.sales}</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Panier moyen</span>
          <strong style={kpiValueStyle}>{currencyFormatter.format(kpis.avgTicket)}</strong>
        </article>
      </section>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Analyse IA</h2>
          <p style={panelSubtitleStyle}>
            {kpis.products < 5
              ? "Votre inventaire est encore limite. Ajoutez de nouvelles references pour fiabiliser les predictions."
              : "Vos niveaux de stock paraissent stables pour les prochains jours."}
          </p>
          <button style={primaryButtonStyle} type="button">
            Optimiser maintenant
          </button>
        </article>

        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Actions prioritaires</h2>
          <ul style={actionListStyle}>
            <li>Verifier les produits en seuil critique.</li>
            <li>Suivre les meilleures ventes de la semaine.</li>
            <li>Planifier les reapprovisionnements fournisseurs.</li>
          </ul>
        </article>
      </div>
    </div>
  );
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const cardShadow = "0 16px 32px -25px rgba(15, 23, 42, 0.28)";

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const pageHeaderStyle: CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "1.52rem",
};

const pageSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
};

const kpiCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  boxShadow: cardShadow,
};

const kpiLabelStyle: CSSProperties = {
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const kpiValueStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
  fontSize: "1.18rem",
};

const getDualPaneStyle = (compact: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
});

const panelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 900,
};

const panelSubtitleStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.5,
};

const primaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
  width: "fit-content",
};

const actionListStyle: CSSProperties = {
  margin: "0 0 0 18px",
  padding: 0,
  color: "#334155",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
