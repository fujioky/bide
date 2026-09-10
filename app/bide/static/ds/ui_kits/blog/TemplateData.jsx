const { ArticleHeader, StatCard, BarChartRow, ComparisonTable, ChartFrame, Sidenote, SectionBreak } = window.LyraBlogDesignSystem_fbfdef;

function TemplateData({ mobile = false, admin = false, onHome }) {
  return (
    <PageShell theme="data" mobile={mobile} admin={admin} sections={window.LyraData.sections.data} activeIndex={0} progress={18} onHome={onHome}>
      <section style={{ padding: mobile ? "var(--sp-6) var(--gutter-mobile)" : "var(--sp-8) var(--gutter-desktop)",
        background: "linear-gradient(180deg, #ebf4fd 0%, var(--data-bg) 100%)", borderBottom: "1px solid var(--border-hairline)" }}>
        <div style={{ maxWidth: "var(--measure-data)", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: mobile ? 28 : "var(--fs-title)", fontWeight: 700 }}>欧洲各国博士税后工资</h1>
          <p style={{ margin: "var(--sp-3) 0 var(--sp-6)", color: "var(--text-muted)", fontSize: "var(--fs-lead)" }}>一份来自真实数据的横向对比 · 15 个国家</p>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: "var(--sp-4)" }}>
            <StatCard value="€2,400" label="最高性价比" note="荷兰 · 净剩 €1,350" />
            <StatCard value="€4,200" label="最高绝对值" note="瑞士 · 苏黎世" tone="accent" />
            <StatCard value="€2,100" label="最大博士群体" note="德国 · 约 20 万人" />
          </div>
        </div>
      </section>
      <Measure width="var(--measure-data)" mobile={mobile}>
        <H2>薪资总览</H2>
        <div style={{ position: "relative" }}>
          <P>下面是各国博士第一年的税后月薪中位数。瑞士的绝对值高出一档，但它的房租也是。</P>
          {!mobile && <Sidenote marker="1">数据取自 2025 年各校公开薪资表与 EURAXESS 汇总。</Sidenote>}
        </div>
        <div style={{ margin: "var(--sp-5) 0" }}>
          <BarChartRow label="瑞士" value={4200} max={4200} display="€4,200" />
          <BarChartRow label="丹麦" value={3100} max={4200} display="€3,100" tone="quiet" />
          <BarChartRow label="荷兰" value={2400} max={4200} display="€2,400" tone="up" />
          <BarChartRow label="德国" value={2100} max={4200} display="€2,100" tone="quiet" />
          <BarChartRow label="法国" value={1900} max={4200} display="€1,900" tone="quiet" />
          <BarChartRow label="西班牙" value={1450} max={4200} display="€1,450" tone="down" />
        </div>
        <H2>生活成本对比</H2>
        <ComparisonTable columns={["国家", "月薪", "房租", "净剩", "评分"]}
          rows={[["瑞士", "€4,200", "€1,500", "€2,700", "★★★★"], ["丹麦", "€3,100", "€1,150", "€1,950", "★★★★"],
                 ["荷兰", "€2,400", "€1,050", "€1,350", "★★★★"], ["德国", "€2,100", "€850", "€1,250", "★★★"],
                 ["法国", "€1,900", "€900", "€1,000", "★★"], ["西班牙", "€1,450", "€700", "€750", "★★"]]} />
        <SectionBreak variant="rule" />
        <H2>净剩与性价比</H2>
        <ChartFrame title="月薪 vs 房租 · 散点" note="数据: 2025 · n=15" height={mobile ? 220 : 300} />
      </Measure>
    </PageShell>
  );
}
Object.assign(window, { TemplateData });
