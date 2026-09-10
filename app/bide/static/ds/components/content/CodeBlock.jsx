import React from "react";
import { LyraIcon } from "../icons/LyraIcon";

export function CodeBlock({ lang = "python", code = "", tokens = null, style }) {
  return (
    <figure style={{ margin: "var(--sp-5) 0", background: "var(--code-bg)", border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-3)", overflow: "hidden", animation: "lyra-slide-left var(--dur-enter) var(--ease-out)", ...style }}>
      <figcaption style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
        borderBottom: "1px solid var(--border-hairline)" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>{lang}</span>
        <button type="button" aria-label="复制" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: 0,
          color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-code)", fontSize: 11 }}>
          <LyraIcon name="copy" size={12} />复制
        </button>
      </figcaption>
      <pre style={{ margin: 0, padding: "var(--sp-4)", overflowX: "auto", fontSize: "var(--fs-code)", lineHeight: "var(--lh-code)",
        color: "var(--code-fg)", background: "transparent" }}>
        <code>{tokens ? tokens.map((t, i) => <span key={i} style={{ color: t.color ? "var(--" + t.color + ")" : "inherit" }}>{t.text}</span>) : code}</code>
      </pre>
    </figure>
  );
}
