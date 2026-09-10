import React from "react";

export function Tag({ children, tone = "default", dot = false, style }) {
  const isAccent = tone === "accent";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--fs-micro)", fontFamily: "var(--font-code)",
      color: isAccent ? "var(--accent)" : "var(--text-muted)", letterSpacing: ".01em", ...style }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: isAccent ? "var(--accent)" : "var(--text-muted)" }} />}
      {children}
    </span>
  );
}
