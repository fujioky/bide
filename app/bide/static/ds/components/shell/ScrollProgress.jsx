import React from "react";

export function ScrollProgress({ value = 0, style }) {
  return (
    <div style={{ height: 2, width: "100%", background: "transparent", ...style }}>
      <div style={{ height: "100%", width: Math.max(0, Math.min(100, value)) + "%", background: "var(--accent)", transition: "width 80ms linear" }} />
    </div>
  );
}
