import React from "react";
import { LyraIcon } from "../icons/LyraIcon";
import { Button } from "../core/Button";

export function GrokPanel({ messages = [], mobile = false, placeholder = "输入你的问题…", onClose, style }) {
  return (
    <section style={{ position: "absolute", zIndex: 40, display: "flex", flexDirection: "column",
      background: "var(--panel-bg)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      border: "1px solid var(--border-hairline)", color: "var(--text-body)",
      ...(mobile
        ? { left: 0, right: 0, bottom: 0, height: "85%", borderRadius: "var(--radius-4) var(--radius-4) 0 0", animation: "lyra-fade-up var(--dur-panel) var(--ease-out)" }
        : { right: 0, bottom: 0, top: 0, width: "var(--panel-w-grok)", animation: "lyra-slide-right var(--dur-panel) var(--ease-out)" }),
      ...style }}>
      {mobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "var(--sp-3) auto 0" }} />}
      <header style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", padding: "var(--sp-4) var(--sp-4)", borderBottom: "1px solid var(--border-hairline)" }}>
        <LyraIcon name="sparkles" size={15} color="var(--accent)" />
        <span style={{ flex: 1, fontSize: "var(--fs-small)", color: "var(--text-heading)", fontWeight: "var(--weight-medium)" }}>Ask about this article</span>
        <button type="button" onClick={onClose} aria-label="关闭" style={{ width: mobile ? 44 : 28, height: mobile ? 44 : 28, display: "grid", placeItems: "center",
          background: "none", border: 0, color: "var(--text-muted)", cursor: "pointer" }}><LyraIcon name="x" size={15} /></button>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-4)", display: "grid", gap: "var(--sp-4)", alignContent: "start" }}>
        {messages.map((m, i) => {
          const me = m.role === "user";
          return (
            <div key={i} style={{ justifySelf: me ? "end" : "start", maxWidth: "86%" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "var(--tracking-label)", textTransform: "uppercase",
                color: "var(--text-muted)", marginBottom: 5, textAlign: me ? "right" : "left" }}>{me ? "You" : "AI"}</div>
              <div style={{ padding: "10px 13px", borderRadius: "var(--radius-3)", fontSize: "var(--fs-small)", lineHeight: "var(--lh-body)",
                background: me ? "var(--accent)" : "var(--surface-raised)", color: me ? "var(--on-accent)" : "var(--text-body)",
                border: me ? "0" : "1px solid var(--border-hairline)" }}>{m.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "var(--sp-2)", padding: "var(--sp-3)", borderTop: "1px solid var(--border-hairline)",
        paddingBottom: mobile ? "calc(var(--sp-3) + env(safe-area-inset-bottom))" : "var(--sp-3)" }}>
        <input placeholder={placeholder} style={{ flex: 1, minWidth: 0, minHeight: 40, padding: "0 12px", borderRadius: "var(--radius-2)",
          background: "var(--surface-page)", border: "1px solid var(--border-hairline)", color: "var(--text-body)",
          fontFamily: "var(--font-body)", fontSize: "var(--fs-small)", outline: "none" }} />
        <Button size="sm" style={{ minHeight: 40 }}>发送</Button>
      </div>
    </section>
  );
}
