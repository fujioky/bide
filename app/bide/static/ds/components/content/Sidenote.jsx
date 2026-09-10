import React from "react";

export function Sidenote({ marker = "1", children, style }) {
  return (
    <aside style={{ position: "absolute", left: "calc(100% + var(--sp-6))", width: 190, display: "flex", gap: "var(--sp-2)",
      fontFamily: "var(--font-sans)", fontSize: "var(--fs-micro)", lineHeight: 1.55, color: "var(--text-muted)", ...style }}>
      <span style={{ color: "var(--accent)", fontFamily: "var(--font-code)" }}>{marker}</span>
      <span>{children}</span>
    </aside>
  );
}
