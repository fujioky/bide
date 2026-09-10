import React from "react";

export function PullQuote({ children, cite = null, variant = "rule", style }) {
  if (variant === "display") {
    return (
      <blockquote style={{ margin: "var(--sp-8) auto", maxWidth: 620, textAlign: "center", position: "relative", ...style }}>
        <span style={{ display: "block", fontFamily: "var(--font-serif-display)", fontSize: 34, lineHeight: 1.35, color: "var(--text-heading)" }}>
          <span style={{ color: "var(--accent)" }}>“</span>{children}<span style={{ color: "var(--accent)" }}>”</span>
        </span>
        {cite && <cite style={{ display: "block", marginTop: "var(--sp-4)", fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)",
          fontStyle: "normal", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>{cite}</cite>}
      </blockquote>
    );
  }
  return (
    <blockquote style={{ margin: "var(--sp-6) 0", paddingLeft: "var(--sp-5)", borderLeft: "2px solid var(--accent)", ...style }}>
      <p style={{ margin: 0, fontSize: "var(--fs-lead)", lineHeight: "var(--lh-essay)", color: "var(--text-muted)" }}>{children}</p>
      {cite && <cite style={{ display: "block", marginTop: "var(--sp-3)", fontSize: "var(--fs-small)", fontStyle: "normal", color: "var(--text-muted)", opacity: .8 }}>— {cite}</cite>}
    </blockquote>
  );
}
