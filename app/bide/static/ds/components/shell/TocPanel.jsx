import React from "react";
import { LyraIcon } from "../icons/LyraIcon";

export function TocPanel({ sections = [], activeIndex = 0, mobile = false, onClose, style }) {
  return (
    <aside style={{ position: "absolute", zIndex: 35, background: "var(--panel-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: "1px solid var(--border-hairline)", color: "var(--text-body)",
      ...(mobile
        ? { left: 0, right: 0, bottom: 0, maxHeight: "50%", borderRadius: "var(--radius-4) var(--radius-4) 0 0", padding: "var(--sp-4) var(--gutter-mobile) calc(var(--sp-6) + env(safe-area-inset-bottom))", animation: "lyra-fade-up var(--dur-panel) var(--ease-out)" }
        : { left: 0, top: "50%", transform: "translateY(-50%)", width: "var(--panel-w-toc)", borderRadius: "0 var(--radius-4) var(--radius-4) 0", padding: "var(--sp-5)", animation: "lyra-slide-left var(--dur-fast) var(--ease-out)" }),
      ...style }}>
      {mobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "0 auto var(--sp-4)" }} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>目录</span>
        <button type="button" onClick={onClose} aria-label="关闭" style={{ width: mobile ? 44 : 28, height: mobile ? 44 : 28, marginRight: mobile ? -10 : -6,
          display: "grid", placeItems: "center", background: "none", border: 0, color: "var(--text-muted)", cursor: "pointer" }}>
          <LyraIcon name="x" size={15} />
        </button>
      </div>
      <div style={{ height: 1, background: "var(--border-hairline)", margin: "var(--sp-3) 0 var(--sp-4)" }} />
      <nav style={{ display: "grid", gap: 2, overflowY: "auto" }}>
        {sections.map((s, i) => {
          const active = i === activeIndex, sub = (s.level || 1) === 2;
          return (
            <a key={s.title + i} href="#" style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minHeight: mobile ? 44 : 30,
              paddingLeft: sub ? "var(--sp-5)" : 0, textDecoration: "none",
              fontSize: sub ? "var(--fs-micro)" : "var(--fs-small)",
              color: active ? "var(--text-heading)" : "var(--text-muted)", fontWeight: active ? "var(--weight-medium)" : "var(--weight-regular)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto",
                background: active ? "var(--accent)" : "transparent", border: active ? "0" : "1px solid var(--border-strong)" }} />
              {s.title}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
