import React from "react";

export function ChartFrame({ title = null, note = null, height = 320, children = null, style }) {
  return (
    <figure style={{ margin: "var(--sp-5) 0", padding: "var(--sp-4)", background: "var(--surface-raised)",
      border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-4)", ...style }}>
      {title && <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-4)" }}>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: "var(--weight-semibold)", color: "var(--text-heading)" }}>{title}</span>
        {note && <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>{note}</span>}
      </figcaption>}
      <div style={{ minHeight: height, display: "grid", placeItems: children ? "stretch" : "center",
        background: children ? "transparent" : "var(--surface-inset)", borderRadius: "var(--radius-2)" }}>
        {children || <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>chart · {height}px</span>}
      </div>
    </figure>
  );
}
