One-line: desktop-only vertical stack of 2–3px dashes, 12px off the left edge, vertically centred; hover reveals the section title, click opens TocPanel.

```jsx
<TocRail sections={[{title:"引言",weight:1},{title:"方法论",weight:3}]} activeIndex={1} onExpand={open} />
```
Dash width 16–40px scaled by `weight`. Never render on mobile — use the bottom 目录 button + TocPanel sheet instead.
