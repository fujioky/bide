const { ArticleHeader, DemoPanel, SliderControl, Playground, StepMarker, Callout, Button, LyraIcon } = window.LyraBlogDesignSystem_fbfdef;

function TemplateTutorial({ mobile = false, admin = false, onHome }) {
  const [sigma, setSigma] = React.useState(0.7);
  return (
    <PageShell theme="tutorial" mobile={mobile} admin={admin} sections={window.LyraData.sections.tutorial} activeIndex={0} progress={26} onHome={onHome}>
      <Measure width="var(--measure-tutorial)" mobile={mobile}>
        <ArticleHeader kicker="Interactive tutorial" title="理解扩散模型的去噪过程" meta={["Lyra", "2026-08-12", "12 min · 3 个可交互组件"]} />
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "150px 1fr", gap: "var(--sp-6)" }}>
          {!mobile && <StepMarker steps={["添加噪声", "学习逆过程", "采样与评估"]} active={0} style={{ position: "sticky", top: 96, alignSelf: "start" }} />}
          <div>
            <H2>Step 1 · 添加噪声</H2>
            <P>前向过程只有一个自由度：噪声强度 σ。把滑块拉到底，图像就退化成纯高斯噪声；模型要学的是这条路的反方向。</P>
            <DemoPanel title="拖动看效果">
              <SliderControl label="噪声强度 σ" value={sigma} onChange={setSigma} />
              <div style={{ marginTop: "var(--sp-3)", height: mobile ? 120 : 160, borderRadius: "var(--radius-2)", background: "var(--surface-inset)",
                display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: "var(--fs-micro)", color: "var(--text-muted)",
                filter: "blur(" + (sigma * 6).toFixed(1) + "px)" }}>canvas · 实时噪声可视化</div>
              <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-4)" }}>
                <Button size="sm" icon={<LyraIcon name="play" size={12} color="var(--on-accent)" />}>运行动画</Button>
                <Button size="sm" variant="outline" onClick={() => setSigma(0.7)}>重置</Button>
              </div>
            </DemoPanel>
            <Callout kind="best">把 σ 的取值范围写在组件旁边，读者才知道自己在什么区间里玩。</Callout>
            <H2>Step 2 · 学习逆过程</H2>
            <P>下面这段可以直接改：把 <code>steps</code> 调小，观察输出张量的方差如何变化。</P>
            <Playground lang="Python" code={"import torch\n\nsteps = 16\nx = torch.randn(3)\nfor t in torch.linspace(1, 0, steps):\n    x = x - (1 / steps) * x\nprint(x)"} output={"tensor([0.1234, -1.0213, 0.5507])"} />
          </div>
        </div>
      </Measure>
    </PageShell>
  );
}
Object.assign(window, { TemplateTutorial });
