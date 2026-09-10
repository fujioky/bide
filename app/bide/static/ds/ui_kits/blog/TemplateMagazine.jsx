const { FigureImage, PullQuote, Tag } = window.LyraBlogDesignSystem_fbfdef;
const { LyraIcon } = window.LyraBlogDesignSystem_fbfdef;

function TemplateMagazine({ mobile = false, admin = false, onHome }) {
  return (
    <PageShell theme="magazine" mobile={mobile} admin={admin} sections={window.LyraData.sections.magazine} activeIndex={1} progress={44} onHome={onHome}>
      <section style={{ position: "relative", height: mobile ? 560 : 760, background: "var(--surface-inset)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "#3a3a3a" }}>full-bleed cover image</span>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 45%, #000 100%)" }} />
        <div style={{ position: "relative", textAlign: "center", padding: "0 var(--gutter-mobile)" }}>
          <div style={{ fontFamily: "var(--font-mono-display)", fontSize: 11, letterSpacing: "var(--tracking-label)", color: "var(--accent)", marginBottom: "var(--sp-4)" }}>2026 · ANNUAL REVIEW</div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif-display)", fontSize: mobile ? 40 : 76, lineHeight: 1.05, color: "var(--text-heading)", fontWeight: 400 }}>A Year of<br />Quiet Work</h1>
        </div>
        <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "grid", placeItems: "center", color: "var(--text-muted)" }}>
          <LyraIcon name="chevron-down" size={20} />
        </div>
      </section>
      <div style={{ maxWidth: "var(--measure-magazine)", margin: "0 auto", padding: mobile ? "var(--sp-7) var(--gutter-mobile)" : "var(--sp-9) var(--gutter-desktop)" }}>
        <P style={{ fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)", lineHeight: 1.75 }}>今年做完的事情比预想的少，留下来的比预想的多。三月在实验室待了整整一个月，出来的时候樱花已经落完了；八月开始写这个博客，把过去两年散在各处的笔记搬进来。</P>
        <P style={{ fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)", lineHeight: 1.75 }}>回头看，值得写下来的都不是结果，是那些安静的、重复的、当时觉得毫无进展的下午。</P>
      </div>
      <FigureImage bleed ratio={mobile ? "4 / 3" : "21 / 9"} caption="Kraków，三月" />
      <div style={{ maxWidth: "var(--measure-magazine)", margin: "0 auto", padding: mobile ? "0 var(--gutter-mobile)" : "0 var(--gutter-desktop)" }}>
        <PullQuote variant="display" cite="八月">写给自己的笔记本，恰好放在公开的地方。</PullQuote>
        <P style={{ fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)", lineHeight: 1.75 }}>明年想把交互文章做成默认形态：能拖的东西，比能读的东西留得久。</P>
        <div style={{ display: "flex", gap: "var(--sp-4)", margin: "var(--sp-7) 0 var(--sp-9)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--border-hairline)" }}>
          <Tag dot tone="accent">随笔</Tag><Tag>#年度总结</Tag>
        </div>
      </div>
    </PageShell>
  );
}
Object.assign(window, { TemplateMagazine });
