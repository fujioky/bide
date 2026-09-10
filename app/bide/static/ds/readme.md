# Lyra Blog — Design System

**Lyra** (天琴座) is an AI-native personal blog by a bioinformatics researcher who also writes about computer science and Chinese classical culture. It is not a themed blog: it is a **content gallery** where every article can be a different web experience — a code-dense technical write-up, a data infographic, a quiet serif essay, a tutorial with live simulators, a dark photo-led magazine piece.

The system that makes that survivable is a contract, not a look:

> **Structure is fixed. Skin is free.**
> Every page carries the same Header, Footer, TOC and Grok entry point, in the same places, with the same behaviour. Colour, type and texture change per article.

That contract is called the **Shell Protocol**, and the skins are six named themes: `home`, `tech`, `data`, `essay`, `tutorial`, `magazine`, applied as `data-lyra-theme="…"` on a page root. Components never hard-code a colour; they read semantic aliases (`--surface-page`, `--text-body`, `--accent`, `--border-hairline`, …) which each theme remaps.

## Sources this system was built from

- **The written spec supplied in chat**: *"Lyra Blog — 设计方案 · 多模板视觉规范" v1.0, 2026-08-22*. It is the only ground truth: it defines the six colour schemes, the Shell Protocol geometry, the TOC dash-rail idea, the Grok panel, the home page layout, the five article templates, motion values and the mobile rules. Everything here traces back to it.
- **No codebase, Figma file, screenshots or slide decks were attached.** Nothing was recreated from memory of another product.
- **Referenced but not supplied**: the site itself (`example.org`), the minimal Lyra-constellation logo SVG ("已有 SVG"), the two existing articles (欧洲博士工资 / 地泽临卦例), and Casdoor for admin login. Sample copy in the UI kit is written in the voice of those two articles, not copied from them.

## Known gaps — please send these

1. **Logo.** No mark was attached, so none was drawn. Wherever the mark belongs, `Wordmark` sets **◆ Lyra** in JetBrains Mono at .18em tracking. Drop the real file at `assets/logo.svg` and render it inside `Wordmark` at the same optical size.
2. **Fonts.** No binaries supplied. Nine families are loaded from **Google Fonts** in `tokens/fonts.css`: Inter, Space Grotesk, Newsreader, Playfair Display, JetBrains Mono, Fira Code, IBM Plex Mono, Noto Sans SC, Noto Serif SC. 楷体 (LXGW WenKai) is **not** included — it exists only as a remote CDN stylesheet; send the `.woff2` and it goes back in as a local `@font-face`. If you self-host, replace those `@import`s with real `@font-face` rules.
3. **Icons.** No icon set supplied. Substituted **Lucide 0.454.0** from CDN (see ICONOGRAPHY). The site favicon at `https://lyra.example.org/icon.svg` could not be reached from here — **please attach `icon.svg` directly** and it becomes the wordmark.
4. **Imagery.** No photos or illustrations supplied; every image slot renders a labelled placeholder.

---

## CONTENT FUNDAMENTALS

**Bilingual by default, Chinese-first in the body.** UI chrome and article prose are Chinese (首页, 分类, 登录, 目录, 发送, 运行, 回顶部); technical labels, metadata and eyebrows are English or monospace Latin (`15 min read`, `Deep technical`, `Ask about this article`, `Output:`, `2026 · ANNUAL REVIEW`). Never translate the mono labels into Chinese — the Latin/CJK contrast *is* the texture.

**Voice: first person, quiet, specific.** The blog is a notebook that happens to be public — the tagline is *"A place for thinking out loud."* / *"写给自己的笔记本"*. Copy states what happened and what it cost, with a real number attached: 「先用 128³ 体素跑通流程，再考虑分辨率。」「荷兰的博士月薪约 €2,400，德国约 €2,100。」

**Never markety.** No 「赋能」, no exclamation marks, no second-person imperatives selling a feature. Advice is phrased as something learned the hard way: 「把采样步数写进 checkpoint 的元数据，否则三个月后你不会记得这条曲线是几步跑出来的。」

**Casing.** Chinese needs none. English UI labels are sentence case (`Ask about this article`). Mono eyebrows, section labels and stat captions are UPPERCASE with .12em tracking (`DEEP TECHNICAL`, `目录` is the one Chinese exception and stays unspaced). Never Title Case A Sentence.

**Punctuation.** Full-width Chinese punctuation in Chinese sentences; a space around inline Latin/numerals (`用 Flow Matching 训练`). Middot `·` separates metadata (`Lyra · 2026-08-20 · 15 min read`). Em-dash sparingly; the essay template prefers a full stop.

**Emoji: no.** The spec sketches used 💡⚠️❌✅🟢🔒📑 as shorthand for callout kinds, admin locks and the interactive marker — in the built system these are all **Lucide glyphs or coloured dots**, never emoji. Country flags in the data template are the one tolerated exception (they are data, not decoration), and even there a text label is acceptable.

**Numbers.** Tabular figures everywhere (`font-variant-numeric: tabular-nums`), currency with the symbol first (`€2,400`), read time as `8 min`, dates as `08/21` on cards and `2026-08-20` in article meta.

---

## VISUAL FOUNDATIONS

**Colour.** There is no brand colour — deliberately. Six palettes, one accent each: star blue `#7aa2f7` (home + tech), data blue `#3182ce` (data), amber-brown `#92400e` (essay), green `#1a7f37` (tutorial, where green means *touchable*), gold `#c9a96e` (magazine, used at most twice per screen). Each theme uses **one accent, two neutrals and one hairline** — never two accents. Semantic red/green/amber appear only inside data and callouts.

**Type.** Every stack pairs a Latin face with a real Chinese face — no CJK ever falls back to a system default. Ten families, and each *skin* gets its own pairing rather than one house font:

| Skin | Heading | Body | Mono |
|---|---|---|---|
| home | JetBrains Mono | Inter + Noto Sans SC | Fira Code |
| tech | JetBrains Mono | Inter + Noto Sans SC | Fira Code |
| data | Space Grotesk | Inter + Noto Sans SC | IBM Plex Mono |
| essay | Newsreader + Noto Serif SC | Noto Serif SC | IBM Plex Mono |
| tutorial | Space Grotesk | Inter + Noto Sans SC | IBM Plex Mono |
| magazine | Playfair Display | Noto Sans SC | JetBrains Mono |

`--font-quote-cjk` (Noto Serif SC 600) carries classical-Chinese quotations; a proper 楷体 belongs there once the font file arrives. Body copy is 17px/1.65, essay 19px/1.9, magazine 18–20px/1.75, mobile never below 16px.

**Footer.** One line, and it stays one line: `© 2026 Lyra · example.org` on the left, `RSS` and `回顶部` on the right. No wordmark (the header has it), no tagline, no social row, at most one icon.

**Layout.** One centred measure per template — 640px essay, 720px magazine, 780px technical, 860px tutorial, 900px data — inside a 1440px page with 48px gutters (24px tablet, 16px mobile). Header 64px desktop / 52px mobile. The only fixed-position furniture: header (sticky on articles), TOC dash rail (left edge, 12px, vertically centred), Grok launcher (bottom right, 24px inset). Panels are 280px (TOC) and 400px (Grok).

**Backgrounds.** Flat surfaces, never photographic wallpaper. Two gradients only: the home hero (`#0d1117 → #161b22`, vertical, optional star-particle layer) and the data template's題图 (`#ebf4fd → #ffffff`). The magazine template's cover uses a top-to-bottom black protection gradient over the image so the title stays legible; that is the system's only protection gradient. No patterns, no noise, no textures.

**Cards.** 12px radius, 1px hairline border, theme-raised background, and a shadow so shallow it reads as a border on light themes (`0 1px 3px rgba(16,24,40,.08)`) and as nothing at all on the magazine theme. Hidden (admin-only) cards swap the solid border for a **dashed accent** border and drop the surface to 60% opacity. Code blocks, widgets and playgrounds use 8px radius; buttons 4px; filter chips full pill; TOC dashes 1px.

**Elevation & blur.** Shadows are for panels, not for content. Transparency + `backdrop-filter: blur(12–18px)` marks exactly three things: the TOC panel, the Grok panel, and the admin dropdown — i.e. anything floating *over* an article. Content never blurs.

**Motion.** Short and mechanical: 100ms press (`scale .97`, never a colour flash), 200ms hover / header hide / TOC slide, 250ms panel in-out, 400ms content fade-up (opacity 0→1, translateY 20→0). Easing is `cubic-bezier(.16,.84,.44,1)` on the way in, standard `(.4,0,.2,1)` for state changes. Exactly one ambient loop exists: the Grok launcher's 3s breathing pulse (1 → 1.05). Per-template accents: code slides in from the left (A), stat numbers count up from 0 (B), **nothing at all in the essay** (C, on purpose), interactive borders glow on focus (D), full-bleed plates parallax faintly (E).

**Hover / press / focus.** Cards lift 4px and gain a 1px accent ring plus a soft accent glow. Links underline left-to-right with a 3px offset — no colour change. Table rows tint to `--surface-inset`. Buttons darken via the accent token, never a new hue. Focus is the accent ring, 1px, plus a 4px translucent halo on interactive widgets. All hover-only information is also reachable by tap on mobile (TOC dash tooltips become the bottom sheet).

**Borders.** 1px hairlines do the structural work — header bottom, footer top, card edges, table rules, panel edges. 3px coloured left borders mark callouts (the *only* coloured-left-border pattern in the system, and it sits on a raised surface, not a tinted one). 2px accent left rule for quotes.

**Imagery.** Cool and documentary: lab, city, screen captures; 16:9 in cards, 21:9 for magazine plates, square corners when full-bleed, 8px radius when inset. Dark themes give inset images a faint shadow so they don't float. No illustration style exists yet — placeholders are labelled, and nothing is generated.

---

## ICONOGRAPHY

- **No icon assets were supplied**, so the system substitutes **Lucide 0.454.0** (CDN: `https://unpkg.com/lucide@0.454.0/dist/umd/lucide.js`) — outline, 1.75px stroke, which matches Lyra's hairline borders. **Flagged as a substitution**: if the blog already ships an icon set, swap it into `components/icons/LyraIcon.jsx` and keep the API.
- Access icons only through `LyraIcon` — never paste raw SVG into a screen, never draw one by hand.
- Sizes: 14 (footer / meta), 16 (nav, buttons), 20 (FAB, mobile menu), 22–24 (hamburger). Colour is always `currentColor` except the callout glyphs, which take the callout's colour.
- The working set is deliberately small: `menu`, `x`, `chevron-right`, `chevron-down`, `arrow-up`, `rss`, `sparkles` (Grok), `copy`, `play`, `list` (mobile TOC), `lightbulb` / `triangle-alert` / `octagon-alert` / `circle-check` (the four callouts), `lock` (hidden articles). **No GitHub icon — Lyra has no GitHub link.** Never repeat the same glyph twice on one screen; if a row of icons is starting to look like a toolbar, delete most of it.
- **Unicode as icon:** one only — **◆** in the wordmark. **Emoji: never** (see CONTENT FUNDAMENTALS). Status is communicated by an 8px coloured dot, not a glyph.
- `assets/` is currently empty of brand marks: no logo, no illustrations, no photography were provided.

---

## Components

Grouped by concern; all are exported on `window.LyraBlogDesignSystem_fbfdef`.

**core** — `Button`, `Tag`, `Pill`, `ArticleCard`
**shell** (Shell Protocol) — `Header`, `Footer`, `Wordmark`, `UserMenu`, `TocRail`, `TocPanel`, `GrokLauncher`, `GrokPanel`, `ScrollProgress`
**content** (article body) — `ArticleHeader`, `CodeBlock`, `Callout`, `MathBlock`, `PullQuote`, `Sidenote`, `SectionBreak`, `FigureImage`
**data** (template B) — `StatCard`, `ComparisonTable`, `BarChartRow`, `ChartFrame`
**interactive** (template D) — `DemoPanel`, `SliderControl`, `Playground`, `StepMarker`
**icons** — `LyraIcon`

Each directory has a `.d.ts` props contract, a `.prompt.md` usage note, and one `@dsCard` HTML showing its states.

### Intentional additions
The spec's delivery list is page-level (six templates + a component state library), so the primitive inventory was derived from what those pages contain. Three items are additions the spec implies but doesn't name:
- `LyraIcon` — one wrapper so no screen ever hand-rolls an SVG.
- `Wordmark` — because the real logo is missing, the type lockup needs a single home.
- `ChartFrame` — the spec asks for a "图表预留区域"; this is that container.

## Files

| Path | What |
|---|---|
| `styles.css` | the only entry point consumers link — `@import`s everything below |
| `tokens/fonts.css` | webfont loading (Google Fonts — substitution, see gaps) |
| `tokens/colors.css` | the six raw palettes |
| `tokens/themes.css` | `:root` + the six `[data-lyra-theme]` semantic maps |
| `tokens/typography.css` | families, scale, line heights, tracking, measures |
| `tokens/spacing.css` | spacing ramp, layout constants, radii, hit targets |
| `tokens/motion.css` | durations, easings, keyframes |
| `tokens/base.css` | element defaults (body, headings, links, code, tables) |
| `components/**` | the primitives above (`.jsx` + `.d.ts` + `.prompt.md` + card) |
| `guidelines/*.html` | 20 foundation specimen cards (Colors / Type / Spacing / Brand) |
| `ui_kits/blog/` | the click-through UI kit — `index.html` + six screens; see its README |
| `templates/article/` | starting template consuming projects can copy: a full article page with a skin picker (`theme`), admin and TOC toggles |
| `thumbnail.html` | homepage tile |
| `SKILL.md` | Agent-Skill front door for Claude Code |

## Using it

```html
<link rel="stylesheet" href="styles.css">
<script src="https://unpkg.com/lucide@0.454.0/dist/umd/lucide.js"></script>
<script src="_ds_bundle.js"></script>
```
```jsx
const { Header, ArticleHeader, CodeBlock, Footer } = window.LyraBlogDesignSystem_fbfdef;
<div data-lyra-theme="tech">
  <Header sticky progress={12} admin />
  <main style={{ maxWidth: "var(--measure-tech)", margin: "0 auto" }}>…</main>
  <Footer />
</div>
```

Pick the theme by content, not by mood: code → `tech`, numbers → `data`, prose → `essay`, widgets → `tutorial`, images → `magazine`, index → `home`.
