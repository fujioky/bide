import React from "react";

export function ComparisonTable({ columns = [], rows = [], zebra = true, align = null, style }) {
  const [hover, setHover] = React.useState(null);
  const colAlign = (i) => (align && align[i]) || (i ? "right" : "left");
  return (
    <div style={{ overflowX: "auto", margin: "var(--sp-5) 0", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-3)", ...style }}>
      <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: "var(--fs-small)" }}>
        <thead>
          <tr>{columns.map((c, i) => (
            <th key={c} style={{ position: "sticky", top: 0, textAlign: colAlign(i), padding: "11px 14px",
              background: "var(--surface-raised)", borderBottom: "1px solid var(--border-strong)", color: "var(--text-heading)",
              fontFamily: "var(--font-body)", fontWeight: "var(--weight-semibold)", fontSize: "var(--fs-micro)",
              letterSpacing: ".04em", whiteSpace: "nowrap" }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} onMouseEnter={() => setHover(ri)} onMouseLeave={() => setHover(null)}
              style={{ background: hover === ri ? "var(--surface-inset)" : zebra && ri % 2 ? "var(--surface-page-alt)" : "transparent",
                transition: "background var(--dur-fast)" }}>
              {r.map((cell, ci) => (
                <td key={ci} style={{ textAlign: colAlign(ci), padding: "11px 14px",
                  borderBottom: "1px solid var(--border-hairline)", color: ci ? "var(--text-body)" : "var(--text-heading)",
                  fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
