import React from "react";

export function UserMenu({ name = "杜嘉诚", open = false, onToggle, style }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <button type="button" onClick={onToggle} aria-label={name}
        style={{ width: 24, height: 24, borderRadius: "50%", cursor: "pointer", padding: 0,
          background: "var(--accent)", color: "var(--on-accent)", border: "1px solid var(--accent)",
          fontFamily: "var(--font-mono-display)", fontSize: 11, lineHeight: 1, display: "grid", placeItems: "center" }}>
        {name.slice(0, 1)}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 34, right: 0, width: 172, zIndex: 40, padding: "var(--sp-3)",
          background: "var(--panel-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-3)", boxShadow: "0 12px 32px rgba(0,0,0,.28)",
          animation: "lyra-fade-up var(--dur-fast) var(--ease-out)" }}>
          <div style={{ fontSize: "var(--fs-small)", color: "var(--text-heading)", fontWeight: "var(--weight-medium)" }}>{name}</div>
          <div style={{ height: 1, background: "var(--border-hairline)", margin: "var(--sp-3) 0" }} />
          {[["管理面板 →", true], ["登出", false]].map(([label]) => (
            <button key={label} type="button" style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 0", background: "none",
              border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: "var(--fs-small)", fontFamily: "var(--font-body)" }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
