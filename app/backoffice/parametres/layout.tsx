"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuConfig = [
  { label: "Collaborateurs", path: "/backoffice/parametres/collaborateurs" },
  { label: "Roles & Permissions", path: "/backoffice/parametres/roles" },
  { label: "Fiscalite", path: "/backoffice/parametres/fiscalite" },
  { label: "Categories", path: "/backoffice/parametres/categories" },
  { label: "Emplacements", path: "/backoffice/parametres/emplacements" },
  { label: "Abonnement", path: "/backoffice/parametres/abonnement" },
];

export default function ParametresLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={pageWrap}>
      <header style={pageHeaderStyle}>
        <h1 style={pageTitle}>Configuration Kipilote</h1>
        <p style={pageSubtitle}>Administration des modules metier et des regles d organisation.</p>
      </header>

      <nav style={subNavBar}>
        {menuConfig.map((item) => (
          <Link key={item.path} href={item.path} style={menuButtonStyle(pathname === item.path)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const pageHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: "0 16px 32px -25px rgba(15, 23, 42, 0.28)",
};

const pageTitle: React.CSSProperties = {
  fontWeight: 900,
  margin: 0,
  fontSize: "1.52rem",
  color: "#ffffff",
};

const pageSubtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
};

const subNavBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  background: "#ffffff",
  padding: "14px",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 16px 32px -25px rgba(15, 23, 42, 0.28)",
};

const menuButtonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "linear-gradient(135deg, #4338ca 0%, #312e81 100%)" : "transparent",
  color: active ? "#ffffff" : "#334155",
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontWeight: 800,
  fontSize: "0.9rem",
  transition: "all 0.2s ease",
  border: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
});
