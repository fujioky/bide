import React from "react";

/* Collapsed TOC: one dash per section, length proportional to section size. */
export function TocRail({ sections = [], activeIndex = 0, onExpand, style }) {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const max = Math.max(...sections.map(s => s.weight || 1), 1);
  return (
    <div onClick={onExpand} style={{ position: "absolute", left: "var(--rail-left-offset)", top: "50%", transform: "translateY(-50%)",
      display: "flex", flexDirection: "column", gap: 7, padding: "var(--sp-3) var(--sp-2)", cursor: "pointer", zIndex: 20, ...style }}>
      {sections.map((s, i) => {
        const active = i === activeIndex, hot = i === hoverIdx;
        return (
          <div key={s.title + i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ position: "relative", display: "flex", alignItems: "center", height: 3 }}>
            <span style={{ width: 16 + ((s.weight || 1) / max) * 24, height: active ? 3 : 2, borderRadius: 1,
              background: active ? "var(--accent)" : "var(--toc-line)", opacity: active ? 1 : hot ? .9 : .55,
              transition: "all var(--dur-fast) var(--ease-standard)" }} />
            {hot && (
              <span style={{ position: "absolute", left: 52, whiteSpace: "nowrap", padding: "4px 9px", borderRadius: "var(--radius-2)",
                background: "var(--panel-bg)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid var(--border-hairline)",
                fontSize: "var(--fs-micro)", fontFamily: "var(--font-code)", color: "var(--text-body)" }}>{s.title}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
