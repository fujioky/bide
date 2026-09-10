import React from "react";
import { LyraIcon } from "../icons/LyraIcon";

export function GrokLauncher({ label = null, mobile = false, onClick, style }) {
  return (
    <button type="button" onClick={onClick} aria-label="Ask about this article"
      style={{ position: "absolute", right: "var(--fab-offset)", bottom: mobile ? "calc(var(--fab-offset) + env(safe-area-inset-bottom))" : "var(--fab-offset)",
        width: label ? "auto" : "var(--fab-size)", height: "var(--fab-size)", padding: label ? "0 18px 0 14px" : 0, gap: 8,
        display: "inline-flex", alignItems: "center", justifyContent: "center", zIndex: 25, cursor: "pointer",
        borderRadius: "var(--radius-pill)", background: "var(--accent)", color: "var(--on-accent)", border: "1px solid var(--accent)",
        boxShadow: "0 8px 24px rgba(0,0,0,.28)", animation: "lyra-pulse var(--pulse-cycle) var(--ease-standard) infinite",
        fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", letterSpacing: ".04em", ...style }}>
      <LyraIcon name="sparkles" size={19} />{label}
    </button>
  );
}
