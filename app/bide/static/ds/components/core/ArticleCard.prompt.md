One-line: the home grid's article card — hover lifts 4px and gains the theme's accent glow.

```jsx
<ArticleCard feature category="研究" date="08/21" title="欧洲各国博士税后工资"
  summary="15 个国家的横向对比" tags={["留学","博士"]} readTime="8 min" />
<ArticleCard hidden category="文化" date="08/20" title="地泽临 · 卦例解析" summary="(仅管理员可见)" />
```

Variants: `default`, `cover` (16:9 slot), `row` (mobile-first compact). `hidden` renders the admin-only state; never show it to visitors.
