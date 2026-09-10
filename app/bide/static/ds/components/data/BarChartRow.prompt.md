One-line: one row of a horizontal bar chart — label, 12px bar, right-aligned figure; stack several for a whole chart.

```jsx
<BarChartRow label="瑞士" value={4200} max={4200} display="€4,200" />
<BarChartRow label="荷兰" value={2400} max={4200} display="€2,400" tone="quiet" />
```
Bars grow from 0 on scroll-in. For anything richer, use ChartFrame and render a real chart inside.
