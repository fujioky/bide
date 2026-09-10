One-line: every Lyra page starts with this — logo left, nav right, auth far right, in exactly that order regardless of skin.

```jsx
<Header sticky progress={38} admin nav={["首页","分类"]} />
<Header mobile />
```

Rules: 64px desktop / 52px mobile. Home page = `static`, no progress line. Article pages = `sticky`, hide on scroll down (`hidden`), fade back in on scroll up, and always show the progress line. Colours come from the wrapping `data-lyra-theme`; never hard-code them here.
