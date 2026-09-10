import React from "react";

export function ArticleHeader({ title, meta = [], kicker = null, align = "left", serif = false, style }) {
  return (
    <header style={{ textAlign: align, marginBottom: "var(--sp-7)", ...style }}>
      {kicker && <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", letterSpacing: "var(--tracking-label)",
        textTransform: "uppercase", color: "var(--accent)", marginBottom: "var(--sp-3)" }}>{kicker}</div>}
      <h1 style={{ margin: 0, fontSize: "var(--fs-title)", fontFamily: serif ? "var(--font-heading)" : undefined,
        fontWeight: "var(--weight-semibold)", lineHeight: "var(--lh-tight)" }}>{title}</h1>
      <div style={{ display: "flex", justifyContent: align === "center" ? "center" : "flex-start", gap: "var(--sp-3)",
        marginTop: "var(--sp-4)", fontSize: "var(--fs-small)", color: "var(--text-muted)", fontFamily: "var(--font-code)" }}>
        {meta.map((m, i) => <span key={i}>{i > 0 && <span style={{ opacity: .5, marginRight: "var(--sp-3)" }}>·</span>}{m}</span>)}
      </div>
      <div style={{ height: 1, background: "var(--border-hairline)", marginTop: "var(--sp-5)" }} />
    </header>
  );
}
