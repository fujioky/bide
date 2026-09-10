One-line: the article-scoped AI conversation — 400px right rail on desktop, 85% bottom sheet on mobile, always frosted over the page.

```jsx
<GrokPanel messages={[{role:"ai",text:"这篇文章讲述了…"},{role:"user",text:"德国和荷兰哪个工资更高？"}]} onClose={close} />
```
AI turns are left-aligned on `--surface-raised`; user turns right-aligned on `--accent`. Input pinned to the bottom, above the safe area.
