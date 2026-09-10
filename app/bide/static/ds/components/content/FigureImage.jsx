import React from "react";

export function FigureImage({ src = null, caption = null, ratio = "16 / 9", bleed = false, rounded = true, style }) {
  return (
    <figure style={{ margin: bleed ? "var(--sp-9) 0" : "var(--sp-6) 0", width: bleed ? "100%" : undefined, ...style }}>
      <div style={{ aspectRatio: ratio, background: "var(--surface-inset)", display: "grid", placeItems: "center", overflow: "hidden",
        borderRadius: bleed || !rounded ? 0 : "var(--radius-3)", border: bleed ? "0" : "1px solid var(--border-hairline)",
        boxShadow: bleed ? "none" : "var(--shadow-card)" }}>
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>image {ratio}</span>}
      </div>
      {caption && <figcaption style={{ marginTop: "var(--sp-3)", fontFamily: "var(--font-sans)", fontSize: "var(--fs-micro)",
        color: "var(--text-muted)", textAlign: bleed ? "right" : "left" }}>{caption}</figcaption>}
    </figure>
  );
}
