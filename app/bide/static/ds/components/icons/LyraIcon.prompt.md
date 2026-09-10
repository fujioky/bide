One-line: renders a Lucide glyph at Lyra's hairline stroke weight; use it for every icon in the shell instead of hand-drawn SVG.

```jsx
<LyraIcon name="rss" size={16} />
<LyraIcon name="sparkles" size={20} color="var(--accent)" />
```

The host page must load Lucide UMD first:
`<script src="https://unpkg.com/lucide@0.454.0/dist/umd/lucide.js"></script>`.
Sizes in use: 14 (footer/meta), 16 (nav, buttons), 20 (FAB), 24 (mobile menu).
