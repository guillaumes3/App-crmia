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
      <h1 style={pageTitle}>Configuration Kipilote</h1>

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
  padding: "30px",
};

const pageTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: "22px",
  fontSize: "1.8rem",
  color: "#0f172a",
};

const subNavBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  background: "#ffffff",
  padding: "12px",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.04)",
  marginBottom: "25px",
};

const menuButtonStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "#4f46e5" : "transparent",
  color: active ? "#ffffff" : "#334155",
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "0.9rem",
  transition: "all 0.2s ease",
  border: active ? "1px solid #4f46e5" : "1px solid #e2e8f0",
});
