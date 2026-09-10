const { Header, Footer, TocRail, TocPanel, GrokLauncher, GrokPanel } = window.LyraBlogDesignSystem_fbfdef;
const { LyraIcon } = window.LyraBlogDesignSystem_fbfdef;

function PageShell({ theme, mobile, admin, sections = [], activeIndex = 0, progress = null, article = true, children, onHome }) {
  const [tocOpen, setTocOpen] = React.useState(false);
  const [grokOpen, setGrokOpen] = React.useState(false);
  return (
    <div data-lyra-theme={theme} style={{ position: "relative", minHeight: mobile ? 844 : 900, width: "100%", overflow: "hidden",
      background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      <div onClick={onHome}><Header mobile={mobile} admin={admin} sticky={article} progress={article ? (progress ?? 38) : null} /></div>
      <main style={{ flex: 1, position: "relative" }}>{children}</main>
      <Footer mobile={mobile} />
      {article && sections.length > 0 && (mobile
        ? <button type="button" onClick={() => setTocOpen(true)} style={{ position: "absolute", left: "var(--gutter-mobile)", bottom: "calc(var(--fab-offset) + env(safe-area-inset-bottom))",
            height: 44, padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8, zIndex: 24, cursor: "pointer",
            borderRadius: "var(--radius-pill)", background: "var(--surface-raised)", color: "var(--text-body)",
            border: "1px solid var(--border-strong)", boxShadow: "0 6px 20px rgba(0,0,0,.24)", fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)" }}>
            <LyraIcon name="list" size={15} />目录
          </button>
        : <TocRail sections={sections} activeIndex={activeIndex} onExpand={() => setTocOpen(true)} />)}
      {tocOpen && <TocPanel sections={sections} activeIndex={activeIndex} mobile={mobile} onClose={() => setTocOpen(false)} />}
      {!grokOpen && <GrokLauncher mobile={mobile} onClick={() => setGrokOpen(true)} />}
      {grokOpen && <GrokPanel messages={window.LyraData.grok} mobile={mobile} onClose={() => setGrokOpen(false)} />}
    </div>
  );
}

/* Centred reading column. */
function Measure({ width = "var(--measure-tech)", mobile, children, style }) {
  return <div style={{ maxWidth: width, margin: "0 auto", padding: mobile ? "var(--sp-6) var(--gutter-mobile) var(--sp-8)" : "var(--sp-8) var(--gutter-desktop) var(--sp-9)", ...style }}>{children}</div>;
}

function H2({ children, mono }) {
  return <h2 style={{ margin: "var(--sp-8) 0 var(--sp-4)", fontSize: "var(--fs-h2)", fontFamily: mono ? "var(--font-mono-display)" : undefined, fontWeight: 600 }}>{children}</h2>;
}
function P({ children, essay, style }) {
  return <p style={{ margin: "0 0 var(--sp-4)", fontSize: essay ? "var(--fs-body-essay)" : "var(--fs-body)", lineHeight: essay ? "var(--lh-essay)" : "var(--lh-body)", ...style }}>{children}</p>;
}
Object.assign(window, { PageShell, Measure, H2, P });
