import React from "react";

export function MathBlock({ tex = "", label = null, style }) {
  return (
    <div style={{ margin: "var(--sp-6) 0", textAlign: "center", ...style }}>
      <div style={{ fontFamily: "var(--font-serif-display)", fontSize: 22, fontStyle: "italic", color: "var(--text-heading)" }}>{tex}</div>
      {label && <div style={{ marginTop: "var(--sp-2)", fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>{label}</div>}
    </div>
  );
}
