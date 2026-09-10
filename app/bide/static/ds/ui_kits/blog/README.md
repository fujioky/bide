# Lyra Blog — UI kit

One product, six surfaces. Every screen is the same **Shell Protocol** (Header → content → Footer, plus TOC rail and Grok launcher) wearing a different skin, set by `data-lyra-theme` on the page root.

| File | Screen | Theme |
|---|---|---|
| `Home.jsx` | 首页 · article index, hero, category filter, waterfall grid | `home` |
| `TemplateTech.jsx` | 模板 A · code-dense long form | `tech` |
| `TemplateData.jsx` | 模板 B · infographic / data report | `data` |
| `TemplateEssay.jsx` | 模板 C · literary essay | `essay` |
| `TemplateTutorial.jsx` | 模板 D · interactive tutorial | `tutorial` |
| `TemplateMagazine.jsx` | 模板 E · dark magazine | `magazine` |
| `PageShell.jsx` | shared shell + `Measure` / `H2` / `P` helpers | — |
| `data.js` | article list, TOC section lists, Grok transcript | — |

## Running it

`index.html` is the click-through: pick a screen, toggle 390px (phone frame) and 管理员 (admin) with the bar at the bottom. Home cards open their article; the header wordmark returns home. TOC and Grok are real state — click the dash rail or the ✦ launcher.

Each screen also has its own card file (`<screen>.card.html`, `<screen>.mobile.card.html`) so the Design System tab can show desktop and mobile side by side.

## What is faked

Charts, cover images and canvases render as labelled placeholders — no imagery was supplied. Code highlighting is hand-tokenised (production uses Prism/Shiki); math is set in the serif face (production uses KaTeX); Grok answers are canned; login is Casdoor-hosted and out of scope.
