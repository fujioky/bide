import React from "react";

export function Pill({ children, active = false, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 15px", minHeight: 34, borderRadius: "var(--radius-pill)", cursor: "pointer", whiteSpace: "nowrap",
        fontSize: "var(--fs-small)", fontFamily: "var(--font-body)", fontWeight: active ? "var(--weight-medium)" : "var(--weight-regular)",
        background: active ? "var(--accent)" : "transparent", color: active ? "var(--on-accent)" : hover ? "var(--text-body)" : "var(--text-muted)",
        border: "1px solid " + (active ? "var(--accent)" : hover ? "var(--border-strong)" : "var(--border-hairline)"),
        transition: "all var(--dur-fast) var(--ease-standard)", ...style }}>
      {children}
    </button>
  );
}
