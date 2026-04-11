"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SettingsModule = {
  id: string;
  label: string;
  description: string;
  href: string;
};

const modules: SettingsModule[] = [
  {
    id: "collaborateurs",
    label: "Collaborateurs",
    description: "Profils, equipes et informations de compte.",
    href: "/backoffice/parametres/collaborateurs",
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    description: "Acces par fonctionnalite et securisation des actions.",
    href: "/backoffice/parametres/roles",
  },
  {
    id: "fiscalite",
    label: "Fiscalite",
    description: "Configuration et suivi des taux de TVA.",
    href: "/backoffice/parametres/fiscalite",
  },
  {
    id: "categories",
    label: "Categories",
    description: "Classification catalogue et navigation commerciale.",
    href: "/backoffice/parametres/categories",
  },
  {
    id: "emplacements",
    label: "Emplacements",
    description: "Zones de stockage et organisation logistique.",
    href: "/backoffice/parametres/emplacements",
  },
  {
    id: "abonnement",
    label: "Abonnement",
    description: "Plan actif, facturation et options de contrat.",
    href: "/backoffice/parametres/abonnement",
  },
];

export default function ParametresPage() {
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth < 1024);
    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  const selectedModule = useMemo(() => {
    return modules.find((item) => item.id === selectedId) ?? modules[0] ?? null;
  }, [selectedId]);

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={pageTitleStyle}>Parametres</h1>
          <p style={pageSubtitleStyle}>Administrez les modules organisationnels et la configuration metier.</p>
        </div>

        <div style={headerActionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => setInfoMessage("Filtres additionnels a venir.")}>
            Filtres
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => setInfoMessage("Export des reglages bientot disponible.")}>
            Export
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => setInfoMessage("Ajout de module gere par l administrateur plateforme.")}>
            Import / Ajouter
          </button>
        </div>
      </header>

      {infoMessage ? <div style={infoBannerStyle}>{infoMessage}</div> : null}

      <div style={getDualPaneStyle(isCompactLayout)}>
        <section style={leftPaneStyle}>
          <div style={cardHeaderStyle}>
            <div style={cardHeadingWrapStyle}>
              <h2 style={cardTitleStyle}>Modules de configuration</h2>
              <span style={countBadgeStyle}>{modules.length}</span>
            </div>
            <button type="button" style={smallPrimaryButtonStyle} onClick={() => setInfoMessage("Creation de module reservee au socle produit.")}>
              + Ajouter
            </button>
          </div>

          <div style={listWrapStyle}>
            {modules.map((module) => {
              const isSelected = module.id === selectedModule?.id;

              return (
                <article key={module.id} style={getListItemStyle(isSelected)}>
                  <button
                    type="button"
                    style={itemContentButtonStyle}
                    onClick={() => {
                      setSelectedId(module.id);
                      setMenuId(null);
                    }}
                  >
                    <strong style={itemTitleStyle}>{module.label}</strong>
                    <span style={itemMetaStyle}>{module.description}</span>
                  </button>

                  <div style={itemRightWrapStyle}>
                    <div style={menuWrapStyle}>
                      <button
                        type="button"
                        style={menuButtonStyle}
                        onClick={() => setMenuId((current) => (current === module.id ? null : module.id))}
                      >
                        ⋮
                      </button>
                      {menuId === module.id ? (
                        <div style={menuPopoverStyle}>
                          <button type="button" style={menuActionStyle} onClick={() => setSelectedId(module.id)}>
                            Details
                          </button>
                          <button
                            type="button"
                            style={menuActionStyle}
                            onClick={() => setInfoMessage(`Ouvrez la page ${module.label} pour modifier les reglages.`)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            style={menuDangerActionStyle}
                            onClick={() => setInfoMessage("Suppression de module non autorisee depuis ce panneau.")}
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={rightPaneStyle}>
          {selectedModule ? (
            <article style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <h2 style={detailTitleStyle}>{selectedModule.label}</h2>
                  <p style={detailSubtitleStyle}>{selectedModule.description}</p>
                </div>
                <span style={modeTagStyle}>Module actif</span>
              </div>

              <div style={detailKpiGridStyle}>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Type</span>
                  <strong style={detailKpiValueStyle}>Configuration</strong>
                </div>
                <div style={detailKpiCardStyle}>
                  <span style={detailKpiLabelStyle}>Etat</span>
                  <strong style={detailKpiValueStyle}>Disponible</strong>
                </div>
              </div>

              <div style={actionCardStyle}>
                <h3 style={actionTitleStyle}>Actions recommandees</h3>
                <ul style={actionListStyle}>
                  <li>Verifier les donnees de reference du module.</li>
                  <li>Mettre a jour les regles metier si necessaire.</li>
                  <li>Valider les impacts sur le reste du backoffice.</li>
                </ul>
              </div>

              <Link href={selectedModule.href} style={openModuleLinkStyle}>
                Ouvrir le module
              </Link>
            </article>
          ) : (
            <div style={emptyStateStyle}>Selectionnez un module a gauche.</div>
          )}
        </section>
      </div>
    </div>
  );
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

const pageStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };
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
const pageTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.45rem", fontWeight: 800, color: palette.slate900 };
const pageSubtitleStyle: React.CSSProperties = { margin: "6px 0 0", color: palette.slate500, fontSize: "0.9rem" };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap" };
const primaryButtonStyle: React.CSSProperties = { border: "none", background: palette.indigoMain, color: palette.white, borderRadius: "12px", padding: "10px 14px", fontWeight: 800, cursor: "pointer", fontSize: "0.85rem" };
const smallPrimaryButtonStyle: React.CSSProperties = { border: "none", background: palette.indigoMain, color: palette.white, borderRadius: "12px", padding: "8px 12px", fontWeight: 800, cursor: "pointer", fontSize: "0.8rem" };
const secondaryButtonStyle: React.CSSProperties = { border: `1px solid ${palette.slate300}`, background: palette.white, color: palette.slate700, borderRadius: "12px", padding: "10px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" };
const infoBannerStyle: React.CSSProperties = { background: palette.mintSoft, color: palette.mintText, border: "1px solid #a7f3d0", borderRadius: "20px", padding: "10px 12px", fontWeight: 700, fontSize: "0.85rem" };
const getDualPaneStyle = (compact: boolean): React.CSSProperties => ({ display: "flex", flexDirection: compact ? "column" : "row", gap: "16px" });
const leftPaneStyle: React.CSSProperties = { flex: "0 0 40%", minWidth: 0, background: palette.white, border: `1px solid ${palette.slate200}`, borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" };
const rightPaneStyle: React.CSSProperties = { flex: "1 1 60%", minWidth: 0, background: palette.white, border: `1px solid ${palette.slate200}`, borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" };
const cardHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" };
const cardHeadingWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px" };
const cardTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.03rem", fontWeight: 800, color: palette.slate900 };
const countBadgeStyle: React.CSSProperties = { minWidth: "28px", height: "28px", borderRadius: "14px", background: palette.indigoSoft, color: palette.indigoDark, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, padding: "0 8px" };
const listWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", maxHeight: "620px" };
const getListItemStyle = (selected: boolean): React.CSSProperties => ({ border: selected ? `1px solid ${palette.indigoMain}` : `1px solid ${palette.slate200}`, borderRadius: "20px", background: selected ? palette.indigoSoft : palette.white, padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" });
const itemContentButtonStyle: React.CSSProperties = { border: "none", background: "transparent", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px", padding: 0, cursor: "pointer", minWidth: 0 };
const itemTitleStyle: React.CSSProperties = { color: palette.slate900, fontSize: "0.9rem", fontWeight: 800 };
const itemMetaStyle: React.CSSProperties = { color: palette.slate500, fontSize: "0.78rem" };
const itemRightWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px" };
const menuWrapStyle: React.CSSProperties = { position: "relative" };
const menuButtonStyle: React.CSSProperties = { width: "34px", height: "34px", borderRadius: "10px", border: `1px solid ${palette.slate300}`, background: palette.white, color: palette.slate700, cursor: "pointer", fontWeight: 800 };
const menuPopoverStyle: React.CSSProperties = { position: "absolute", right: 0, top: "38px", zIndex: 20, minWidth: "140px", borderRadius: "12px", border: `1px solid ${palette.slate200}`, background: palette.white, display: "flex", flexDirection: "column", gap: "4px", padding: "6px", boxShadow: "0 18px 30px -22px rgba(15,23,42,0.6)" };
const menuActionStyle: React.CSSProperties = { border: "none", background: "#f8fafc", color: palette.slate700, borderRadius: "10px", padding: "8px 10px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 };
const menuDangerActionStyle: React.CSSProperties = { border: "none", background: palette.salmonSoft, color: palette.salmonText, borderRadius: "10px", padding: "8px 10px", textAlign: "left", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 };
const detailCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "20px", background: "#f8fafc", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" };
const detailHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" };
const detailTitleStyle: React.CSSProperties = { margin: 0, fontSize: "1.2rem", fontWeight: 800, color: palette.slate900 };
const detailSubtitleStyle: React.CSSProperties = { margin: "5px 0 0", color: palette.slate500, fontSize: "0.84rem" };
const modeTagStyle: React.CSSProperties = { background: palette.indigoSoft, color: palette.indigoDark, borderRadius: "999px", padding: "6px 10px", fontWeight: 800, fontSize: "0.72rem" };
const detailKpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" };
const detailKpiCardStyle: React.CSSProperties = { border: `1px solid ${palette.slate200}`, borderRadius: "20px", background: palette.white, padding: "10px", display: "flex", flexDirection: "column", gap: "4px" };
const detailKpiLabelStyle: React.CSSProperties = { color: palette.slate500, fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" };
const detailKpiValueStyle: React.CSSProperties = { color: palette.slate900, fontWeight: 800, fontSize: "0.95rem" };
const actionCardStyle: React.CSSProperties = { border: `1px dashed ${palette.slate300}`, borderRadius: "20px", background: palette.white, padding: "12px" };
const actionTitleStyle: React.CSSProperties = { margin: 0, fontSize: "0.92rem", fontWeight: 800, color: palette.slate900 };
const actionListStyle: React.CSSProperties = { margin: "8px 0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: "6px", color: palette.slate700, fontSize: "0.84rem" };
const openModuleLinkStyle: React.CSSProperties = { display: "inline-block", border: "none", background: palette.indigoMain, color: palette.white, borderRadius: "12px", padding: "10px 14px", textDecoration: "none", fontWeight: 800, fontSize: "0.85rem", width: "fit-content" };
const emptyStateStyle: React.CSSProperties = { minHeight: "170px", border: `1px dashed ${palette.slate300}`, borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: palette.slate500, fontWeight: 700, fontSize: "0.88rem", padding: "12px" };
