import { type CSSProperties } from "react";

export default function AccessDeniedPage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>Acces refuse</h1>
        <p style={textStyle}>
          Votre role ne permet pas d acceder a cette page.
        </p>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "#f8fafc",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "480px",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  padding: "24px",
  boxShadow: "0 20px 45px -30px rgba(15, 23, 42, 0.35)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.5rem",
  fontWeight: 900,
};

const textStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#475569",
  lineHeight: 1.5,
};
