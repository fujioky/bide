import React from "react";

export function StepMarker({ steps = [], active = 0, style }) {
  return (
    <ol style={{ listStyle: "none", margin: "var(--sp-5) 0", padding: 0, display: "grid", gap: 0, ...style }}>
      {steps.map((s, i) => {
        const on = i <= active, cur = i === active;
        return (
          <li key={s} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: "var(--sp-3)", minHeight: 40 }}>
            <span style={{ position: "relative", display: "grid", justifyItems: "center" }}>
              <span style={{ width: cur ? 11 : 8, height: cur ? 11 : 8, borderRadius: "50%", marginTop: 6,
                background: on ? "var(--accent)" : "transparent", border: on ? 0 : "1px solid var(--border-strong)" }} />
              {i < steps.length - 1 && <span style={{ width: 1, flex: 1, background: "var(--border-hairline)", marginTop: 4 }} />}
            </span>
            <span style={{ paddingBottom: "var(--sp-4)", fontSize: "var(--fs-small)",
              color: cur ? "var(--text-heading)" : "var(--text-muted)", fontWeight: cur ? "var(--weight-medium)" : "var(--weight-regular)" }}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
