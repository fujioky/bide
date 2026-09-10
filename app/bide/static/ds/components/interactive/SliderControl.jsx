import React from "react";

export function SliderControl({ label, value = 0.5, min = 0, max = 1, step = 0.01, unit = "", onChange, style }) {
  const [v, setV] = React.useState(value);
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <label style={{ display: "grid", gap: "var(--sp-2)", ...style }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-small)", color: "var(--text-body)" }}>
        <span>{label}</span>
        <span style={{ fontFamily: "var(--font-code)", color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{v}{unit}</span>
      </span>
      <span style={{ position: "relative", height: "var(--hit-min)", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: "var(--surface-inset)" }} />
        <span style={{ position: "absolute", left: 0, width: pct + "%", height: 4, borderRadius: 2, background: "var(--accent)" }} />
        <span style={{ position: "absolute", left: "calc(" + pct + "% - 8px)", width: 16, height: 16, borderRadius: "50%",
          background: "var(--surface-page)", border: "2px solid var(--accent)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
        <input type="range" min={min} max={max} step={step} value={v}
          onChange={e => { const n = Number(e.target.value); setV(n); onChange && onChange(n); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      </span>
    </label>
  );
}
