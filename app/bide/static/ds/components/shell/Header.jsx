import React from "react";
import { Wordmark } from "./Wordmark";
import { UserMenu } from "./UserMenu";
import { Button } from "../core/Button";
import { LyraIcon } from "../icons/LyraIcon";

export function Header({ nav = ["首页", "分类"], admin = false, mobile = false, progress = null, hidden = false, sticky = false, style }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <header style={{ position: sticky ? "sticky" : "static", top: 0, zIndex: 30, width: "100%",
      height: mobile ? "var(--header-h-mobile)" : "var(--header-h-desktop)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: mobile ? "0 var(--gutter-mobile)" : "0 var(--gutter-desktop)",
      background: "var(--surface-page)", borderBottom: "1px solid var(--border-hairline)",
      transform: hidden ? "translateY(-100%)" : "none", transition: "transform var(--dur-fast) var(--ease-standard)", ...style }}>
      <Wordmark size={mobile ? 14 : 16} />
      {mobile ? (
        <button type="button" aria-label="菜单" style={{ width: 44, height: 44, marginRight: -10, display: "grid", placeItems: "center",
          background: "none", border: 0, color: "var(--text-body)", cursor: "pointer" }}>
          <LyraIcon name="menu" size={22} />
        </button>
      ) : (
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
          {nav.map(n => (
            <a key={n} href="#" style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", textDecoration: "none" }}>{n}</a>
          ))}
          {admin
            ? <UserMenu open={menuOpen} onToggle={() => setMenuOpen(o => !o)} />
            : <Button variant="ghost" size="sm" icon={<LyraIcon name="chevron-right" size={13} />}>登录</Button>}
        </nav>
      )}
      {progress != null && (
        <div style={{ position: "absolute", left: 0, bottom: -1, height: 2, width: progress + "%", background: "var(--accent)", transition: "width 80ms linear" }} />
      )}
    </header>
  );
}
