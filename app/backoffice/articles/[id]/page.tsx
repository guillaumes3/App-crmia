"use client";

import React, { useEffect, useState } from "react";

export default function DetailArticle({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const [p, setP] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("mes_produits") || "[]");
    const found = data.find((item: any) => item.id === id);
    if (found) {
      setP(found);
      setDescription(found.description || "");
    }
  }, [id]);

  if (!p) return <div style={loadingStyle}>Chargement...</div>;

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Pilotage article</h1>
          <p style={pageSubtitleStyle}>{p.nom}</p>
        </div>
        <button onClick={() => window.location.assign("/backoffice/articles")} style={ghostButtonStyle}>
          Retour
        </button>
      </header>

      <section style={kpiGridStyle}>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Marge globale</span>
          <strong style={kpiValueStyle}>27.9%</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Stock</span>
          <strong style={kpiValueStyle}>{p.stock ?? 0} U.</strong>
        </article>
        <article style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Canal</span>
          <strong style={kpiValueStyle}>Shopify / Amazon</strong>
        </article>
      </section>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Descriptif & SEO</h2>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={textAreaStyle} />
        </article>

        <article style={panelStyle}>
          <h2 style={panelTitleStyle}>Assistant IA</h2>
          <p style={panelTextStyle}>Generez une fiche optimisee Amazon et Shopify pour harmoniser votre catalogue.</p>
          <button onClick={() => setDescription("Texte optimise pour Amazon et Shopify...")} style={primaryButtonStyle}>
            Generer la fiche
          </button>
        </article>
      </div>
    </div>
  );
}

const cardShadow = "0 16px 32px -25px rgba(15, 23, 42, 0.28)";

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const loadingStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const pageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "1.52rem",
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontWeight: 600,
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.35)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
};

const kpiCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  background: "#ffffff",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  boxShadow: cardShadow,
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 800,
  fontSize: "0.72rem",
};

const kpiValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
});

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  background: "#ffffff",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 900,
};

const panelTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "0.88rem",
  outline: "none",
  resize: "vertical",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
  width: "fit-content",
};
