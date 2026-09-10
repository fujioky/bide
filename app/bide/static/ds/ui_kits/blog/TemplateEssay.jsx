const { ArticleHeader, PullQuote, SectionBreak, Sidenote } = window.LyraBlogDesignSystem_fbfdef;

function TemplateEssay({ mobile = false, admin = false, onHome }) {
  return (
    <PageShell theme="essay" mobile={mobile} admin={admin} sections={window.LyraData.sections.essay} activeIndex={1} progress={52} onHome={onHome}>
      <Measure width="var(--measure-essay)" mobile={mobile}>
        <ArticleHeader align="center" serif title="地泽临" meta={["2026 年 8 月", "某个安静的下午"]} />
        <p style={{ margin: "0 0 var(--sp-5)", fontSize: "var(--fs-body-essay)", lineHeight: "var(--lh-essay)" }}>
          <span style={{ float: "left", fontFamily: "var(--font-serif-cjk)", fontSize: 68, lineHeight: .82, paddingRight: 12, paddingTop: 6, color: "var(--accent)" }}>临</span>
          卦名从水边来。泽在下，地在上，水气升到土里去，草就长起来了。占到这一卦的那天午后很安静，风从水面过去，什么也没带走，只把光挪了半寸。
        </p>
        <div style={{ position: "relative" }}>
          <P essay>我不太信占卜能预言什么，但我信它能让人把问题说清楚——你得先把想问的事情写下来，才好摇那六次。写的过程里，多半就已经知道答案。</P>
          {!mobile && <Sidenote marker="1">《周易》临卦，兑下坤上。</Sidenote>}
        </div>
        <PullQuote cite="易 · 临卦">泽上有地，临。君子以教思无穷，容保民无疆。</PullQuote>
        <P essay>「教思无穷」这四个字，落到一个做生物信息的人身上，大概就是：不要因为流水线跑通了就停下来想。管子接好了，水会自己流，但水里有什么，还是得自己去看。</P>
        <SectionBreak />
        <P essay>后来那支卦的答案没有应验，也没有落空。它只是让那个下午变得可以被记住——这已经比大多数下午做得更多了。</P>
      </Measure>
    </PageShell>
  );
}
Object.assign(window, { TemplateEssay });
