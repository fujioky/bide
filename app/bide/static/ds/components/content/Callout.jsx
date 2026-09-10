import React from "react";
import { LyraIcon } from "../icons/LyraIcon";

const KINDS = {
  tip: { icon: "lightbulb", label: "提示", color: "var(--accent)" },
  warning: { icon: "triangle-alert", label: "警告", color: "var(--data-amber)" },
  danger: { icon: "octagon-alert", label: "危险", color: "var(--tokyo-red)" },
  best: { icon: "circle-check", label: "最佳实践", color: "var(--gh-green-solid)" }
};

export function Callout({ kind = "tip", title = null, children, style }) {
  const k = KINDS[kind] || KINDS.tip;
  return (
    <aside style={{ display: "flex", gap: "var(--sp-3)", margin: "var(--sp-5) 0", padding: "var(--sp-4)",
      background: "var(--surface-raised)", borderLeft: "var(--border-accent) solid " + k.color,
      borderRadius: "0 var(--radius-3) var(--radius-3) 0", ...style }}>
      <span style={{ color: k.color, marginTop: 2 }}><LyraIcon name={k.icon} size={16} color={k.color} /></span>
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-micro)", fontFamily: "var(--font-code)", letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase", color: k.color }}>{title || k.label}</span>
        <div style={{ fontSize: "var(--fs-small)", lineHeight: "var(--lh-body)", color: "var(--text-body)" }}>{children}</div>
      </div>
    </aside>
  );
}
