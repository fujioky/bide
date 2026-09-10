const { Header, Footer, ArticleCard, Pill, GrokLauncher, Wordmark } = window.LyraBlogDesignSystem_fbfdef;

function Home({ mobile = false, admin = false, onOpen }) {
  const [cat, setCat] = React.useState("全部");
  const list = window.LyraData.articles.filter(a => (admin || !a.hidden) && (cat === "全部" || a.cat === cat));
  return (
    <div data-lyra-theme="home" style={{ position: "relative", minHeight: mobile ? 844 : 900, width: "100%", overflow: "hidden",
      background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      <Header mobile={mobile} admin={admin} />
      <main style={{ flex: 1 }}>
        <section style={{ padding: mobile ? "var(--sp-7) var(--gutter-mobile) var(--sp-6)" : "var(--sp-9) var(--gutter-desktop) var(--sp-7)",
          background: "linear-gradient(180deg, var(--space-900) 0%, var(--space-850) 100%)", borderBottom: "1px solid var(--border-hairline)" }}>
          <div style={{ fontFamily: "var(--font-mono-display)", fontSize: mobile ? 44 : "var(--fs-hero)", letterSpacing: "var(--tracking-hero)",
            color: "var(--text-heading)", lineHeight: 1, animation: "lyra-fade-up var(--dur-enter) var(--ease-out)" }}>LYRA</div>
          <div style={{ display: "flex", gap: 6, margin: "var(--sp-5) 0 var(--sp-4)" }}>
            {[26, 14, 34, 18].map((w, i) => <span key={i} style={{ width: w, height: 2, borderRadius: 1, background: i === 2 ? "var(--accent)" : "var(--toc-line)" }} />)}
          </div>
          <p style={{ margin: "0 0 var(--sp-6)", fontSize: mobile ? "var(--fs-small)" : "var(--fs-lead)", color: "var(--text-muted)" }}>A place for thinking out loud.</p>
          <div style={{ display: "flex", gap: "var(--sp-2)", overflowX: mobile ? "auto" : "visible", paddingBottom: mobile ? 4 : 0 }}>
            {window.LyraData.cats.map(c => <Pill key={c} active={c === cat} onClick={() => setCat(c)}>{c}</Pill>)}
          </div>
        </section>
        <section style={{ padding: mobile ? "var(--sp-5) var(--gutter-mobile) var(--sp-8)" : "var(--sp-7) var(--gutter-desktop) var(--sp-9)" }}>
          <div style={{ columns: mobile ? 1 : 3, columnGap: "var(--sp-5)" }}>
            {list.map((a, i) => (
              <div key={a.id} style={{ breakInside: "avoid", marginBottom: "var(--sp-5)" }}>
                <ArticleCard variant={mobile ? (i === 0 ? "default" : "row") : a.cover ? "cover" : "default"}
                  feature={!mobile && a.feature} hidden={a.hidden} category={a.cat} date={a.date} title={a.title}
                  summary={a.summary} tags={a.tags} readTime={a.read} onClick={() => a.screen && onOpen && onOpen(a.screen)} />
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer mobile={mobile} showBackToTop={false} />
      <GrokLauncher mobile={mobile} label={mobile ? null : "Ask"} />
    </div>
  );
}
Object.assign(window, { Home });
