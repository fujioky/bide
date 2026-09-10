import React from "react";

export function DemoPanel({ label = "交互", title = null, focused = false, children, style }) {
  return (
    <section style={{ margin: "var(--sp-5) 0", padding: "var(--sp-4)", background: "var(--surface-raised)",
      border: "1px solid " + (focused ? "var(--accent)" : "var(--border-hairline)"), borderRadius: "var(--radius-3)",
      animation: focused ? "lyra-focus-glow 2s var(--ease-standard) infinite" : "none", ...style }}>
      <header style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gh-green-solid)" }} />
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase", color: "var(--accent)" }}>{label}</span>
        {title && <span style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)" }}>{title}</span>}
      </header>
      {children}
    </section>
  );
}
