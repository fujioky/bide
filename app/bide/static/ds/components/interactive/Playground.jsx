import React from "react";
import { LyraIcon } from "../icons/LyraIcon";
import { Button } from "../core/Button";

export function Playground({ lang = "Python", code = "", output = "", editable = true, style }) {
  return (
    <section style={{ margin: "var(--sp-5) 0", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-3)",
      background: "var(--surface-raised)", overflow: "hidden", ...style }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)",
        padding: "8px 10px 8px 12px", borderBottom: "1px solid var(--border-hairline)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>
          {lang}<LyraIcon name="chevron-down" size={12} />
        </span>
        <Button size="sm" icon={<LyraIcon name="play" size={12} color="var(--on-accent)" />}>运行</Button>
      </header>
      <textarea readOnly={!editable} defaultValue={code} spellCheck={false}
        style={{ display: "block", width: "100%", minHeight: 116, resize: "vertical", border: 0, outline: "none", padding: "var(--sp-4)",
          background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-code)", fontSize: "var(--fs-code)", lineHeight: "var(--lh-code)" }} />
      <div style={{ borderTop: "1px dashed var(--border-hairline)", padding: "var(--sp-3) var(--sp-4)" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)", marginBottom: 6 }}>Output:</div>
        <pre style={{ margin: 0, background: "transparent", color: "var(--text-body)", fontSize: "var(--fs-code-sm)", overflowX: "auto" }}>{output}</pre>
      </div>
    </section>
  );
}
