import React from "react";

export function StatCard({ value, label, note = null, tone = "neutral", style }) {
  const color = { neutral: "var(--text-heading)", up: "var(--data-green)", down: "var(--data-red)", accent: "var(--accent)" }[tone];
  return (
    <div style={{ padding: "var(--sp-5)", background: "var(--surface-raised)", border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-4)", boxShadow: "var(--shadow-card)", display: "grid", gap: 6, ...style }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 30, fontWeight: "var(--weight-bold)", lineHeight: 1,
        color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-body)" }}>{label}</div>
      {note && <div style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>{note}</div>}
    </div>
  );
}
