import React from "react";

/* No logo binary shipped with the brief, so the mark IS the name set in the
   display mono face. Keep the diamond as a plain unicode glyph — do not draw
   a constellation. Swap in assets/logo.svg if the real mark arrives. */
export function Wordmark({ size = 16, showDiamond = true, style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono-display)", fontSize: size,
      fontWeight: "var(--weight-medium)", letterSpacing: ".18em", color: "var(--text-heading)", textTransform: "uppercase", ...style }}>
      {showDiamond && <span style={{ color: "var(--accent)", fontSize: size * .8, letterSpacing: 0 }}>◆</span>}
      Lyra
    </span>
  );
}
