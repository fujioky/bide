import React from "react";

export function Button({ variant = "solid", size = "md", full = false, disabled = false, icon = null, children, onClick, style }) {
  const [down, setDown] = React.useState(false);
  const pad = size === "sm" ? "6px 12px" : size === "lg" ? "12px 22px" : "9px 16px";
  const fs = size === "sm" ? "var(--fs-micro)" : size === "lg" ? "var(--fs-body)" : "var(--fs-small)";
  const skin = {
    solid: { background: "var(--accent)", color: "var(--on-accent)", border: "1px solid var(--accent)" },
    outline: { background: "transparent", color: "var(--text-body)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
    quiet: { background: "var(--surface-raised)", color: "var(--text-body)", border: "1px solid var(--border-hairline)" }
  }[variant];
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)}
      style={{ display: full ? "flex" : "inline-flex", width: full ? "100%" : undefined, alignItems: "center", justifyContent: "center", gap: "var(--sp-2)",
        minHeight: size === "sm" ? 32 : 38, padding: pad, fontSize: fs, fontFamily: "var(--font-body)", fontWeight: "var(--weight-medium)",
        borderRadius: "var(--radius-2)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .45 : 1,
        transform: down ? "scale(var(--press-scale))" : "none", transition: "transform var(--dur-instant) var(--ease-standard), background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast)",
        ...skin, ...style }}>
      {icon}{children}
    </button>
  );
}
