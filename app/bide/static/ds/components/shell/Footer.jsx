import React from "react";
import { LyraIcon } from "../icons/LyraIcon";

/* Deliberately thin: one line of provenance, one link, one way up.
   No wordmark (the header already has it), no repeated glyph set. */
export function Footer({ mobile = false, showBackToTop = true, links = ["RSS"], style }) {
  const linkStyle = { minHeight: mobile ? 44 : 0, display: "inline-flex", alignItems: "center",
    fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)", textDecoration: "none" };
  return (
    <footer style={{ minHeight: "var(--footer-min-h)", display: "flex", alignItems: "center",
      borderTop: "1px solid var(--border-hairline)", background: "var(--surface-page-alt)",
      padding: mobile ? "var(--sp-5) var(--gutter-mobile)" : "var(--sp-5) var(--gutter-desktop)", ...style }}>
      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", alignItems: mobile ? "flex-start" : "center",
        justifyContent: "space-between", gap: mobile ? "var(--sp-3)" : "var(--sp-5)", width: "100%" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>© 2026 Lyra · example.org</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
          {links.map(l => <a key={l} href="#" style={linkStyle}>{l}</a>)}
          {showBackToTop && <a href="#" style={{ ...linkStyle, gap: 5 }}><LyraIcon name="arrow-up" size={13} />回顶部</a>}
        </div>
      </div>
    </footer>
  );
}
