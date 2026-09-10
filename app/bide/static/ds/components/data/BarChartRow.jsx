import React from "react";

export function BarChartRow({ label, value, max = 100, display = null, tone = "accent", style }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = { accent: "var(--accent)", up: "var(--data-green)", down: "var(--data-red)", quiet: "var(--border-strong)" }[tone];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "88px 1fr 76px", alignItems: "center", gap: "var(--sp-3)", padding: "5px 0", ...style }}>
      <span style={{ fontSize: "var(--fs-small)", color: "var(--text-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ height: 12, background: "var(--surface-inset)", borderRadius: "var(--radius-1)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: pct + "%", background: color, transition: "width var(--dur-enter) var(--ease-out)" }} />
      </span>
      <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-code-sm)", color: "var(--text-heading)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{display ?? value}</span>
    </div>
  );
}
