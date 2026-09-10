import React from "react";
import { Tag } from "./Tag";

export function ArticleCard({ title, summary, category, date, tags = [], readTime, variant = "default", cover = null, hidden = false, feature = false, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const base = {
    display: "flex", flexDirection: "column", gap: "var(--sp-3)", textAlign: "left", width: "100%", cursor: "pointer",
    background: hidden ? "color-mix(in srgb, var(--surface-raised) 60%, transparent)" : "var(--surface-raised)",
    border: (hidden ? "1px dashed var(--accent)" : "1px solid var(--border-hairline)"),
    borderRadius: "var(--radius-4)", padding: "var(--sp-5)", color: "inherit", font: "inherit",
    transform: hover ? "translateY(var(--lift-hover))" : "none",
    boxShadow: hover ? "var(--glow-card)" : "var(--shadow-card)",
    transition: "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
  };

  if (variant === "row") {
    return (
      <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...base, padding: "var(--sp-4)", borderRadius: "var(--radius-3)", gap: "var(--sp-1)", transform: "none", ...style }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)", width: "100%" }}>
          <Tag dot tone="accent">{category}</Tag>
          <span style={{ flex: 1, fontFamily: "var(--font-heading)", fontSize: "var(--fs-small)", fontWeight: "var(--weight-medium)", color: "var(--text-heading)" }}>{title}</span>
          <Tag>{date}</Tag>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)", width: "100%" }}>
          <span style={{ flex: 1, fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>{summary}</span>
          <Tag>· {readTime}</Tag>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...base, ...style }}>
      {variant === "cover" && (
        <div style={{ aspectRatio: "16 / 9", borderRadius: "var(--radius-3)", overflow: "hidden", background: "var(--surface-inset)", display: "grid", placeItems: "center" }}>
          {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>cover 16:9</span>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)" }}>
        <Tag dot tone={hidden ? "default" : "accent"}>{hidden ? "隐藏文章" : category}</Tag>
        <Tag>{date}</Tag>
      </div>
      <h3 style={{ margin: 0, fontSize: feature ? "var(--fs-h1)" : "var(--fs-h3)", lineHeight: "var(--lh-heading)", fontWeight: "var(--weight-semibold)" }}>{title}</h3>
      {summary && <p style={{ margin: 0, fontSize: "var(--fs-small)", color: "var(--text-muted)", lineHeight: "var(--lh-body)" }}>{summary}</p>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)", marginTop: "auto", paddingTop: "var(--sp-2)" }}>
        <span style={{ display: "flex", gap: "var(--sp-3)" }}>{tags.map(t => <Tag key={t}>#{t}</Tag>)}</span>
        {readTime && <Tag>· {readTime}</Tag>}
      </div>
    </button>
  );
}
