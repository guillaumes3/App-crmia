"use client";

import { useEffect, useState } from "react";

export default function ProfilPage() {
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Mon profil</h1>
          <p style={pageSubtitleStyle}>Preferences de compte, securite et notifications.</p>
        </div>
      </header>

      <div style={getDualPaneStyle(isCompactLayout)}>
        <article style={panelStyle}>
          <div style={identityStyle}>
            <div style={avatarStyle}>GS</div>
            <div>
              <div style={nameStyle}>Guillaume S.</div>
              <div style={roleBadgeStyle}>Administrateur</div>
            </div>
          </div>

          <div style={kpiGridStyle}>
            <div style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Statut</span>
              <strong style={kpiValueStyle}>Actif</strong>
            </div>
            <div style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Acces</span>
              <strong style={kpiValueStyle}>Complet</strong>
            </div>
          </div>
        </article>

        <article style={panelStyle}>
          <div style={fieldWrapStyle}>
            <label style={fieldLabelStyle}>Adresse email</label>
            <input type="email" defaultValue="guillaume@entreprise.com" style={fieldInputStyle} />
          </div>

          <div style={fieldWrapStyle}>
            <label style={fieldLabelStyle}>Changer le mot de passe</label>
            <input type="password" placeholder="••••••••" style={fieldInputStyle} />
          </div>

          <label style={checkboxWrapStyle}>
            <input type="checkbox" defaultChecked />
            <span style={checkboxTextStyle}>Recevoir les alertes de stock critique et les rapports hebdomadaires.</span>
          </label>

          <button style={primaryButtonStyle}>Sauvegarder les modifications</button>
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

const pageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: cardShadow,
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
};

const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(300px, 360px) 1fr",
  gap: "16px",
});

const panelStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "16px",
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const identityStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const avatarStyle: React.CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const nameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
  fontSize: "1.05rem",
};

const roleBadgeStyle: React.CSSProperties = {
  marginTop: "6px",
  width: "fit-content",
  borderRadius: "999px",
  padding: "6px 10px",
  background: "#e0e7ff",
  color: "#312e81",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "12px",
};

const kpiCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const kpiValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  fontWeight: 800,
};

const fieldInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "10px 12px",
  outline: "none",
  color: "#0f172a",
};

const checkboxWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
};

const checkboxTextStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "0.86rem",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
};
