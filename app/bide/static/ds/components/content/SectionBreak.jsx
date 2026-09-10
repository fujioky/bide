import React from "react";

export function SectionBreak({ variant = "asterism", style }) {
  if (variant === "rule") return <hr style={{ border: 0, height: 1, background: "var(--border-hairline)", margin: "var(--sp-7) 0", ...style }} />;
  return (
    <div style={{ textAlign: "center", margin: "var(--sp-8) 0", letterSpacing: "1.2em", color: "var(--text-muted)",
      fontSize: "var(--fs-body)", opacity: .7, ...style }}>* * *</div>
  );
}
