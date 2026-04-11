import React from "react";

export interface StockStatusBadgeProps {
  quantite: number;
  seuil: number;
}

type StockState = "rupture" | "stock_bas" | "ok";

interface StockVisualConfig {
  label: string;
  dotColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

export default function StockStatusBadge({ quantite, seuil }: StockStatusBadgeProps) {
  const state = resolveStockState(quantite, seuil);
  const visual = STOCK_VISUALS[state];

  return (
    <span style={{ ...badgeStyle, backgroundColor: visual.backgroundColor, color: visual.textColor, borderColor: visual.borderColor }}>
      <span style={{ ...dotStyle, backgroundColor: visual.dotColor }} />
      {visual.label}
    </span>
  );
}

function resolveStockState(quantite: number, seuil: number): StockState {
  if (quantite <= 0) {
    return "rupture";
  }

  if (quantite <= seuil) {
    return "stock_bas";
  }

  return "ok";
}

const STOCK_VISUALS: Record<StockState, StockVisualConfig> = {
  rupture: {
    label: "Rupture",
    dotColor: "#f43f5e",
    backgroundColor: "#ffe4e6",
    textColor: "#9f1239",
    borderColor: "#fecdd3",
  },
  stock_bas: {
    label: "Stock bas",
    dotColor: "#fb7185",
    backgroundColor: "#fff1f2",
    textColor: "#be123c",
    borderColor: "#fecdd3",
  },
  ok: {
    label: "Stock OK",
    dotColor: "#10b981",
    backgroundColor: "#d1fae5",
    textColor: "#065f46",
    borderColor: "#a7f3d0",
  },
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 12px",
  borderRadius: "999px",
  borderStyle: "solid",
  borderWidth: "1px",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const dotStyle: React.CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  boxShadow: "0 0 0 4px rgba(15, 23, 42, 0.03)",
};
