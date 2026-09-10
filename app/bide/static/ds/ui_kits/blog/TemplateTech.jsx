const { ArticleHeader, CodeBlock, Callout, MathBlock, PullQuote, FigureImage, Tag } = window.LyraBlogDesignSystem_fbfdef;

function TemplateTech({ mobile = false, admin = false, onHome }) {
  return (
    <PageShell theme="tech" mobile={mobile} admin={admin} sections={window.LyraData.sections.tech} activeIndex={1} progress={34} onHome={onHome}>
      <Measure width="var(--measure-tech)" mobile={mobile}>
        <ArticleHeader kicker="Deep technical" title="使用 Flow Matching 训练 3D 人脸生成器" meta={["Lyra", "2026-08-20", "15 min read"]} />
        <H2 mono>问题背景</H2>
        <P>扩散模型在 3D 上的主要痛点不是质量，而是采样成本：一个 512³ 的体素网格上跑 250 步去噪，单张卡要几十秒。Flow matching 把生成过程重写成一条常微分方程，训练目标从"预测噪声"变成"预测速度场"，采样步数因此可以压到十几步。</P>
        <CodeBlock lang="python" code={"import torch\n\ndef flow_matching_target(x0, x1, t):\n    \"\"\"x0: 噪声  x1: 数据  t: [B, 1]\"\"\"\n    xt = (1 - t) * x0 + t * x1\n    vt = x1 - x0            # 恒定速度场\n    return xt, vt"} />
        <Callout kind="tip">先用 128³ 体素把整条链路跑通，再考虑分辨率。</Callout>
        <H2 mono>数学推导</H2>
        <P>给定一对样本 <code>(x₀, x₁)</code>，我们只需让网络在插值点上回归恒定速度：</P>
        <MathBlock tex="dx/dt = v_θ(x, t),   L = E‖v_θ(xₜ, t) − (x₁ − x₀)‖²" label="(1)" />
        <P>这条损失没有噪声调度表，也没有 SNR 权重需要调——这是它最省心的地方。</P>
        <Callout kind="warning">在 float16 下速度场的方差会被截断，训练中期容易塌到均值脸。</Callout>
        <H2 mono>实验结果</H2>
        <P>在 8k 张扫描人脸上训练 40 个 epoch，16 步采样的 FID 已经接近 250 步的扩散基线。</P>
        <FigureImage ratio="16 / 9" caption="图 1 · 16 步 vs 250 步采样的速度场轨迹" />
        <PullQuote cite="训练日志 · 第 31 epoch">把采样步数写进 checkpoint 的元数据，否则三个月后你不会记得这条曲线是几步跑出来的。</PullQuote>
        <div style={{ display: "flex", gap: "var(--sp-4)", marginTop: "var(--sp-7)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--border-hairline)" }}>
          <Tag dot tone="accent">技术</Tag><Tag>#生成模型</Tag><Tag>#PyTorch</Tag>
        </div>
      </Measure>
    </PageShell>
  );
}
Object.assign(window, { TemplateTech });
