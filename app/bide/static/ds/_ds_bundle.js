/* @ds-bundle: {"format":4,"namespace":"LyraBlogDesignSystem_fbfdef","components":[{"name":"ArticleHeader","sourcePath":"components/content/ArticleHeader.jsx"},{"name":"Callout","sourcePath":"components/content/Callout.jsx"},{"name":"CodeBlock","sourcePath":"components/content/CodeBlock.jsx"},{"name":"FigureImage","sourcePath":"components/content/FigureImage.jsx"},{"name":"MathBlock","sourcePath":"components/content/MathBlock.jsx"},{"name":"PullQuote","sourcePath":"components/content/PullQuote.jsx"},{"name":"SectionBreak","sourcePath":"components/content/SectionBreak.jsx"},{"name":"Sidenote","sourcePath":"components/content/Sidenote.jsx"},{"name":"ArticleCard","sourcePath":"components/core/ArticleCard.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"BarChartRow","sourcePath":"components/data/BarChartRow.jsx"},{"name":"ChartFrame","sourcePath":"components/data/ChartFrame.jsx"},{"name":"ComparisonTable","sourcePath":"components/data/ComparisonTable.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"LyraIcon","sourcePath":"components/icons/LyraIcon.jsx"},{"name":"DemoPanel","sourcePath":"components/interactive/DemoPanel.jsx"},{"name":"Playground","sourcePath":"components/interactive/Playground.jsx"},{"name":"SliderControl","sourcePath":"components/interactive/SliderControl.jsx"},{"name":"StepMarker","sourcePath":"components/interactive/StepMarker.jsx"},{"name":"Footer","sourcePath":"components/shell/Footer.jsx"},{"name":"GrokLauncher","sourcePath":"components/shell/GrokLauncher.jsx"},{"name":"GrokPanel","sourcePath":"components/shell/GrokPanel.jsx"},{"name":"Header","sourcePath":"components/shell/Header.jsx"},{"name":"ScrollProgress","sourcePath":"components/shell/ScrollProgress.jsx"},{"name":"TocPanel","sourcePath":"components/shell/TocPanel.jsx"},{"name":"TocRail","sourcePath":"components/shell/TocRail.jsx"},{"name":"UserMenu","sourcePath":"components/shell/UserMenu.jsx"},{"name":"Wordmark","sourcePath":"components/shell/Wordmark.jsx"}],"sourceHashes":{"components/content/ArticleHeader.jsx":"117cfccdfae0","components/content/Callout.jsx":"da5cb3147e2b","components/content/CodeBlock.jsx":"7d8fda545182","components/content/FigureImage.jsx":"21e04dd45eef","components/content/MathBlock.jsx":"ae6122e0e8af","components/content/PullQuote.jsx":"48524a3a34a5","components/content/SectionBreak.jsx":"80e4fc30d24f","components/content/Sidenote.jsx":"b74d72932dd8","components/core/ArticleCard.jsx":"825c2355b449","components/core/Button.jsx":"8510ca695228","components/core/Pill.jsx":"8bd66af9c129","components/core/Tag.jsx":"7754bdc3a6f1","components/data/BarChartRow.jsx":"37e5390a6757","components/data/ChartFrame.jsx":"d3fe398104ad","components/data/ComparisonTable.jsx":"d3da529dfeb4","components/data/StatCard.jsx":"f687568f3537","components/icons/LyraIcon.jsx":"1bbe1f790975","components/interactive/DemoPanel.jsx":"ce50bb87013c","components/interactive/Playground.jsx":"5750e10f2701","components/interactive/SliderControl.jsx":"7f1f6cdc0c92","components/interactive/StepMarker.jsx":"85bbe1a8e1eb","components/shell/Footer.jsx":"5a58c3929e2a","components/shell/GrokLauncher.jsx":"8d7b8c75bcdc","components/shell/GrokPanel.jsx":"ab364723dd40","components/shell/Header.jsx":"72c36cc6481e","components/shell/ScrollProgress.jsx":"c52a2533e8fc","components/shell/TocPanel.jsx":"2c9dda4e2edd","components/shell/TocRail.jsx":"cdd13c25dfcc","components/shell/UserMenu.jsx":"49297319d855","components/shell/Wordmark.jsx":"660d88293ede","ui_kits/blog/Home.jsx":"07a853cab183","ui_kits/blog/PageShell.jsx":"664df50f44d2","ui_kits/blog/TemplateData.jsx":"70eb3d736b12","ui_kits/blog/TemplateEssay.jsx":"42febf80dd75","ui_kits/blog/TemplateMagazine.jsx":"c6832567e43d","ui_kits/blog/TemplateTech.jsx":"d96df9079f52","ui_kits/blog/TemplateTutorial.jsx":"b77e5e963490","ui_kits/blog/data.js":"5a932a04c7af"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LyraBlogDesignSystem_fbfdef = window.LyraBlogDesignSystem_fbfdef || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/content/ArticleHeader.jsx
try { (() => {
function ArticleHeader({
  title,
  meta = [],
  kicker = null,
  align = "left",
  serif = false,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      textAlign: align,
      marginBottom: "var(--sp-7)",
      ...style
    }
  }, kicker && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: "var(--accent)",
      marginBottom: "var(--sp-3)"
    }
  }, kicker), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: "var(--fs-title)",
      fontFamily: serif ? "var(--font-heading)" : undefined,
      fontWeight: "var(--weight-semibold)",
      lineHeight: "var(--lh-tight)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: align === "center" ? "center" : "flex-start",
      gap: "var(--sp-3)",
      marginTop: "var(--sp-4)",
      fontSize: "var(--fs-small)",
      color: "var(--text-muted)",
      fontFamily: "var(--font-code)"
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .5,
      marginRight: "var(--sp-3)"
    }
  }, "\xB7"), m))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-hairline)",
      marginTop: "var(--sp-5)"
    }
  }));
}
Object.assign(__ds_scope, { ArticleHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ArticleHeader.jsx", error: String((e && e.message) || e) }); }

// components/content/FigureImage.jsx
try { (() => {
function FigureImage({
  src = null,
  caption = null,
  ratio = "16 / 9",
  bleed = false,
  rounded = true,
  style
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: bleed ? "var(--sp-9) 0" : "var(--sp-6) 0",
      width: bleed ? "100%" : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: ratio,
      background: "var(--surface-inset)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      borderRadius: bleed || !rounded ? 0 : "var(--radius-3)",
      border: bleed ? "0" : "1px solid var(--border-hairline)",
      boxShadow: bleed ? "none" : "var(--shadow-card)"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, "image ", ratio)), caption && /*#__PURE__*/React.createElement("figcaption", {
    style: {
      marginTop: "var(--sp-3)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)",
      textAlign: bleed ? "right" : "left"
    }
  }, caption));
}
Object.assign(__ds_scope, { FigureImage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/FigureImage.jsx", error: String((e && e.message) || e) }); }

// components/content/MathBlock.jsx
try { (() => {
function MathBlock({
  tex = "",
  label = null,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "var(--sp-6) 0",
      textAlign: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif-display)",
      fontSize: 22,
      fontStyle: "italic",
      color: "var(--text-heading)"
    }
  }, tex), label && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-2)",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, label));
}
Object.assign(__ds_scope, { MathBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/MathBlock.jsx", error: String((e && e.message) || e) }); }

// components/content/PullQuote.jsx
try { (() => {
function PullQuote({
  children,
  cite = null,
  variant = "rule",
  style
}) {
  if (variant === "display") {
    return /*#__PURE__*/React.createElement("blockquote", {
      style: {
        margin: "var(--sp-8) auto",
        maxWidth: 620,
        textAlign: "center",
        position: "relative",
        ...style
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontFamily: "var(--font-serif-display)",
        fontSize: 34,
        lineHeight: 1.35,
        color: "var(--text-heading)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--accent)"
      }
    }, "\u201C"), children, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--accent)"
      }
    }, "\u201D")), cite && /*#__PURE__*/React.createElement("cite", {
      style: {
        display: "block",
        marginTop: "var(--sp-4)",
        fontFamily: "var(--font-code)",
        fontSize: "var(--fs-micro)",
        fontStyle: "normal",
        letterSpacing: "var(--tracking-label)",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }
    }, cite));
  }
  return /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: "var(--sp-6) 0",
      paddingLeft: "var(--sp-5)",
      borderLeft: "2px solid var(--accent)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--fs-lead)",
      lineHeight: "var(--lh-essay)",
      color: "var(--text-muted)"
    }
  }, children), cite && /*#__PURE__*/React.createElement("cite", {
    style: {
      display: "block",
      marginTop: "var(--sp-3)",
      fontSize: "var(--fs-small)",
      fontStyle: "normal",
      color: "var(--text-muted)",
      opacity: .8
    }
  }, "\u2014 ", cite));
}
Object.assign(__ds_scope, { PullQuote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/PullQuote.jsx", error: String((e && e.message) || e) }); }

// components/content/SectionBreak.jsx
try { (() => {
function SectionBreak({
  variant = "asterism",
  style
}) {
  if (variant === "rule") return /*#__PURE__*/React.createElement("hr", {
    style: {
      border: 0,
      height: 1,
      background: "var(--border-hairline)",
      margin: "var(--sp-7) 0",
      ...style
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      margin: "var(--sp-8) 0",
      letterSpacing: "1.2em",
      color: "var(--text-muted)",
      fontSize: "var(--fs-body)",
      opacity: .7,
      ...style
    }
  }, "* * *");
}
Object.assign(__ds_scope, { SectionBreak });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/SectionBreak.jsx", error: String((e && e.message) || e) }); }

// components/content/Sidenote.jsx
try { (() => {
function Sidenote({
  marker = "1",
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      position: "absolute",
      left: "calc(100% + var(--sp-6))",
      width: 190,
      display: "flex",
      gap: "var(--sp-2)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-micro)",
      lineHeight: 1.55,
      color: "var(--text-muted)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)",
      fontFamily: "var(--font-code)"
    }
  }, marker), /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { Sidenote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Sidenote.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function Button({
  variant = "solid",
  size = "md",
  full = false,
  disabled = false,
  icon = null,
  children,
  onClick,
  style
}) {
  const [down, setDown] = React.useState(false);
  const pad = size === "sm" ? "6px 12px" : size === "lg" ? "12px 22px" : "9px 16px";
  const fs = size === "sm" ? "var(--fs-micro)" : size === "lg" ? "var(--fs-body)" : "var(--fs-small)";
  const skin = {
    solid: {
      background: "var(--accent)",
      color: "var(--on-accent)",
      border: "1px solid var(--accent)"
    },
    outline: {
      background: "transparent",
      color: "var(--text-body)",
      border: "1px solid var(--border-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-muted)",
      border: "1px solid transparent"
    },
    quiet: {
      background: "var(--surface-raised)",
      color: "var(--text-body)",
      border: "1px solid var(--border-hairline)"
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      display: full ? "flex" : "inline-flex",
      width: full ? "100%" : undefined,
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--sp-2)",
      minHeight: size === "sm" ? 32 : 38,
      padding: pad,
      fontSize: fs,
      fontFamily: "var(--font-body)",
      fontWeight: "var(--weight-medium)",
      borderRadius: "var(--radius-2)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .45 : 1,
      transform: down ? "scale(var(--press-scale))" : "none",
      transition: "transform var(--dur-instant) var(--ease-standard), background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast)",
      ...skin,
      ...style
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Pill.jsx
try { (() => {
function Pill({
  children,
  active = false,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      padding: "7px 15px",
      minHeight: 34,
      borderRadius: "var(--radius-pill)",
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontSize: "var(--fs-small)",
      fontFamily: "var(--font-body)",
      fontWeight: active ? "var(--weight-medium)" : "var(--weight-regular)",
      background: active ? "var(--accent)" : "transparent",
      color: active ? "var(--on-accent)" : hover ? "var(--text-body)" : "var(--text-muted)",
      border: "1px solid " + (active ? "var(--accent)" : hover ? "var(--border-strong)" : "var(--border-hairline)"),
      transition: "all var(--dur-fast) var(--ease-standard)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pill.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function Tag({
  children,
  tone = "default",
  dot = false,
  style
}) {
  const isAccent = tone === "accent";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: "var(--fs-micro)",
      fontFamily: "var(--font-code)",
      color: isAccent ? "var(--accent)" : "var(--text-muted)",
      letterSpacing: ".01em",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: isAccent ? "var(--accent)" : "var(--text-muted)"
    }
  }), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/ArticleCard.jsx
try { (() => {
function ArticleCard({
  title,
  summary,
  category,
  date,
  tags = [],
  readTime,
  variant = "default",
  cover = null,
  hidden = false,
  feature = false,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const base = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sp-3)",
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
    background: hidden ? "color-mix(in srgb, var(--surface-raised) 60%, transparent)" : "var(--surface-raised)",
    border: hidden ? "1px dashed var(--accent)" : "1px solid var(--border-hairline)",
    borderRadius: "var(--radius-4)",
    padding: "var(--sp-5)",
    color: "inherit",
    font: "inherit",
    transform: hover ? "translateY(var(--lift-hover))" : "none",
    boxShadow: hover ? "var(--glow-card)" : "var(--shadow-card)",
    transition: "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"
  };
  if (variant === "row") {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        ...base,
        padding: "var(--sp-4)",
        borderRadius: "var(--radius-3)",
        gap: "var(--sp-1)",
        transform: "none",
        ...style
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--sp-3)",
        width: "100%"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
      dot: true,
      tone: "accent"
    }, category), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontFamily: "var(--font-heading)",
        fontSize: "var(--fs-small)",
        fontWeight: "var(--weight-medium)",
        color: "var(--text-heading)"
      }
    }, title), /*#__PURE__*/React.createElement(__ds_scope.Tag, null, date)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--sp-3)",
        width: "100%"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: "var(--fs-micro)",
        color: "var(--text-muted)"
      }
    }, summary), /*#__PURE__*/React.createElement(__ds_scope.Tag, null, "\xB7 ", readTime)));
  }
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...style
    }
  }, variant === "cover" && /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: "16 / 9",
      borderRadius: "var(--radius-3)",
      overflow: "hidden",
      background: "var(--surface-inset)",
      display: "grid",
      placeItems: "center"
    }
  }, cover ? /*#__PURE__*/React.createElement("img", {
    src: cover,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, "cover 16:9")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    dot: true,
    tone: hidden ? "default" : "accent"
  }, hidden ? "隐藏文章" : category), /*#__PURE__*/React.createElement(__ds_scope.Tag, null, date)), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: feature ? "var(--fs-h1)" : "var(--fs-h3)",
      lineHeight: "var(--lh-heading)",
      fontWeight: "var(--weight-semibold)"
    }
  }, title), summary && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--fs-small)",
      color: "var(--text-muted)",
      lineHeight: "var(--lh-body)"
    }
  }, summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--sp-3)",
      marginTop: "auto",
      paddingTop: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: "var(--sp-3)"
    }
  }, tags.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t
  }, "#", t))), readTime && /*#__PURE__*/React.createElement(__ds_scope.Tag, null, "\xB7 ", readTime)));
}
Object.assign(__ds_scope, { ArticleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ArticleCard.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChartRow.jsx
try { (() => {
function BarChartRow({
  label,
  value,
  max = 100,
  display = null,
  tone = "accent",
  style
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const color = {
    accent: "var(--accent)",
    up: "var(--data-green)",
    down: "var(--data-red)",
    quiet: "var(--border-strong)"
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "88px 1fr 76px",
      alignItems: "center",
      gap: "var(--sp-3)",
      padding: "5px 0",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--text-body)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      height: 12,
      background: "var(--surface-inset)",
      borderRadius: "var(--radius-1)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      height: "100%",
      width: pct + "%",
      background: color,
      transition: "width var(--dur-enter) var(--ease-out)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-code-sm)",
      color: "var(--text-heading)",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums"
    }
  }, display ?? value));
}
Object.assign(__ds_scope, { BarChartRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChartRow.jsx", error: String((e && e.message) || e) }); }

// components/data/ChartFrame.jsx
try { (() => {
function ChartFrame({
  title = null,
  note = null,
  height = 320,
  children = null,
  style
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: "var(--sp-5) 0",
      padding: "var(--sp-4)",
      background: "var(--surface-raised)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-4)",
      ...style
    }
  }, title && /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-small)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-heading)"
    }
  }, title), note && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, note)), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: height,
      display: "grid",
      placeItems: children ? "stretch" : "center",
      background: children ? "transparent" : "var(--surface-inset)",
      borderRadius: "var(--radius-2)"
    }
  }, children || /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, "chart \xB7 ", height, "px")));
}
Object.assign(__ds_scope, { ChartFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ChartFrame.jsx", error: String((e && e.message) || e) }); }

// components/data/ComparisonTable.jsx
try { (() => {
function ComparisonTable({
  columns = [],
  rows = [],
  zebra = true,
  align = null,
  style
}) {
  const [hover, setHover] = React.useState(null);
  const colAlign = i => align && align[i] || (i ? "right" : "left");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      margin: "var(--sp-5) 0",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-3)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      minWidth: 520,
      borderCollapse: "collapse",
      fontSize: "var(--fs-small)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: c,
    style: {
      position: "sticky",
      top: 0,
      textAlign: colAlign(i),
      padding: "11px 14px",
      background: "var(--surface-raised)",
      borderBottom: "1px solid var(--border-strong)",
      color: "var(--text-heading)",
      fontFamily: "var(--font-body)",
      fontWeight: "var(--weight-semibold)",
      fontSize: "var(--fs-micro)",
      letterSpacing: ".04em",
      whiteSpace: "nowrap"
    }
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    onMouseEnter: () => setHover(ri),
    onMouseLeave: () => setHover(null),
    style: {
      background: hover === ri ? "var(--surface-inset)" : zebra && ri % 2 ? "var(--surface-page-alt)" : "transparent",
      transition: "background var(--dur-fast)"
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    style: {
      textAlign: colAlign(ci),
      padding: "11px 14px",
      borderBottom: "1px solid var(--border-hairline)",
      color: ci ? "var(--text-body)" : "var(--text-heading)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap"
    }
  }, cell)))))));
}
Object.assign(__ds_scope, { ComparisonTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ComparisonTable.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function StatCard({
  value,
  label,
  note = null,
  tone = "neutral",
  style
}) {
  const color = {
    neutral: "var(--text-heading)",
    up: "var(--data-green)",
    down: "var(--data-red)",
    accent: "var(--accent)"
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-5)",
      background: "var(--surface-raised)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-4)",
      boxShadow: "var(--shadow-card)",
      display: "grid",
      gap: 6,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: 30,
      fontWeight: "var(--weight-bold)",
      lineHeight: 1,
      color,
      fontVariantNumeric: "tabular-nums"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--text-body)"
    }
  }, label), note && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, note));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/icons/LyraIcon.jsx
try { (() => {
/* Thin wrapper over the Lucide UMD build (loaded from CDN by the host page).
   Lyra ships no icon binaries of its own; Lucide's 1.75px stroke matches the
   hairline feel of the shell. Falls back to nothing if the CDN is absent. */
function LyraIcon({
  name,
  size = 16,
  strokeWidth = 1.75,
  color = "currentColor",
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    i.setAttribute("width", size);
    i.setAttribute("height", size);
    i.setAttribute("stroke-width", strokeWidth);
    i.setAttribute("stroke", color);
    host.appendChild(i);
    if (window.lucide) window.lucide.createIcons({
      nameAttr: "data-lucide"
    });
  }, [name, size, strokeWidth, color]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      flex: "0 0 auto",
      ...style
    }
  });
}
Object.assign(__ds_scope, { LyraIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/LyraIcon.jsx", error: String((e && e.message) || e) }); }

// components/content/Callout.jsx
try { (() => {
const KINDS = {
  tip: {
    icon: "lightbulb",
    label: "提示",
    color: "var(--accent)"
  },
  warning: {
    icon: "triangle-alert",
    label: "警告",
    color: "var(--data-amber)"
  },
  danger: {
    icon: "octagon-alert",
    label: "危险",
    color: "var(--tokyo-red)"
  },
  best: {
    icon: "circle-check",
    label: "最佳实践",
    color: "var(--gh-green-solid)"
  }
};
function Callout({
  kind = "tip",
  title = null,
  children,
  style
}) {
  const k = KINDS[kind] || KINDS.tip;
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      gap: "var(--sp-3)",
      margin: "var(--sp-5) 0",
      padding: "var(--sp-4)",
      background: "var(--surface-raised)",
      borderLeft: "var(--border-accent) solid " + k.color,
      borderRadius: "0 var(--radius-3) var(--radius-3) 0",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: k.color,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: k.icon,
    size: 16,
    color: k.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-micro)",
      fontFamily: "var(--font-code)",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: k.color
    }
  }, title || k.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-small)",
      lineHeight: "var(--lh-body)",
      color: "var(--text-body)"
    }
  }, children)));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Callout.jsx", error: String((e && e.message) || e) }); }

// components/content/CodeBlock.jsx
try { (() => {
function CodeBlock({
  lang = "python",
  code = "",
  tokens = null,
  style
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: "var(--sp-5) 0",
      background: "var(--code-bg)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-3)",
      overflow: "hidden",
      animation: "lyra-slide-left var(--dur-enter) var(--ease-out)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: 11,
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, lang), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "\u590D\u5236",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "none",
      border: 0,
      color: "var(--text-muted)",
      cursor: "pointer",
      fontFamily: "var(--font-code)",
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "copy",
    size: 12
  }), "\u590D\u5236")), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      padding: "var(--sp-4)",
      overflowX: "auto",
      fontSize: "var(--fs-code)",
      lineHeight: "var(--lh-code)",
      color: "var(--code-fg)",
      background: "transparent"
    }
  }, /*#__PURE__*/React.createElement("code", null, tokens ? tokens.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      color: t.color ? "var(--" + t.color + ")" : "inherit"
    }
  }, t.text)) : code)));
}
Object.assign(__ds_scope, { CodeBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/CodeBlock.jsx", error: String((e && e.message) || e) }); }

// components/interactive/DemoPanel.jsx
try { (() => {
function DemoPanel({
  label = "交互",
  title = null,
  focused = false,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      margin: "var(--sp-5) 0",
      padding: "var(--sp-4)",
      background: "var(--surface-raised)",
      border: "1px solid " + (focused ? "var(--accent)" : "var(--border-hairline)"),
      borderRadius: "var(--radius-3)",
      animation: focused ? "lyra-focus-glow 2s var(--ease-standard) infinite" : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-2)",
      marginBottom: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "var(--gh-green-solid)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: "var(--accent)"
    }
  }, label), title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--text-muted)"
    }
  }, title)), children);
}
Object.assign(__ds_scope, { DemoPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/interactive/DemoPanel.jsx", error: String((e && e.message) || e) }); }

// components/interactive/Playground.jsx
try { (() => {
function Playground({
  lang = "Python",
  code = "",
  output = "",
  editable = true,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      margin: "var(--sp-5) 0",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-3)",
      background: "var(--surface-raised)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--sp-3)",
      padding: "8px 10px 8px 12px",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, lang, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "chevron-down",
    size: 12
  })), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    icon: /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
      name: "play",
      size: 12,
      color: "var(--on-accent)"
    })
  }, "\u8FD0\u884C")), /*#__PURE__*/React.createElement("textarea", {
    readOnly: !editable,
    defaultValue: code,
    spellCheck: false,
    style: {
      display: "block",
      width: "100%",
      minHeight: 116,
      resize: "vertical",
      border: 0,
      outline: "none",
      padding: "var(--sp-4)",
      background: "var(--surface-page)",
      color: "var(--text-body)",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-code)",
      lineHeight: "var(--lh-code)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px dashed var(--border-hairline)",
      padding: "var(--sp-3) var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)",
      marginBottom: 6
    }
  }, "Output:"), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      background: "transparent",
      color: "var(--text-body)",
      fontSize: "var(--fs-code-sm)",
      overflowX: "auto"
    }
  }, output)));
}
Object.assign(__ds_scope, { Playground });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/interactive/Playground.jsx", error: String((e && e.message) || e) }); }

// components/interactive/SliderControl.jsx
try { (() => {
function SliderControl({
  label,
  value = 0.5,
  min = 0,
  max = 1,
  step = 0.01,
  unit = "",
  onChange,
  style
}) {
  const [v, setV] = React.useState(value);
  const pct = (v - min) / (max - min) * 100;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: "var(--sp-2)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "var(--fs-small)",
      color: "var(--text-body)"
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      color: "var(--accent)",
      fontVariantNumeric: "tabular-nums"
    }
  }, v, unit)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      height: "var(--hit-min)",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 4,
      borderRadius: 2,
      background: "var(--surface-inset)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      width: pct + "%",
      height: 4,
      borderRadius: 2,
      background: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: "calc(" + pct + "% - 8px)",
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: "var(--surface-page)",
      border: "2px solid var(--accent)",
      boxShadow: "0 1px 3px rgba(0,0,0,.2)"
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: v,
    onChange: e => {
      const n = Number(e.target.value);
      setV(n);
      onChange && onChange(n);
    },
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      opacity: 0,
      cursor: "pointer",
      margin: 0
    }
  })));
}
Object.assign(__ds_scope, { SliderControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/interactive/SliderControl.jsx", error: String((e && e.message) || e) }); }

// components/interactive/StepMarker.jsx
try { (() => {
function StepMarker({
  steps = [],
  active = 0,
  style
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      listStyle: "none",
      margin: "var(--sp-5) 0",
      padding: 0,
      display: "grid",
      gap: 0,
      ...style
    }
  }, steps.map((s, i) => {
    const on = i <= active,
      cur = i === active;
    return /*#__PURE__*/React.createElement("li", {
      key: s,
      style: {
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: "var(--sp-3)",
        minHeight: 40
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "grid",
        justifyItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: cur ? 11 : 8,
        height: cur ? 11 : 8,
        borderRadius: "50%",
        marginTop: 6,
        background: on ? "var(--accent)" : "transparent",
        border: on ? 0 : "1px solid var(--border-strong)"
      }
    }), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 1,
        flex: 1,
        background: "var(--border-hairline)",
        marginTop: 4
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        paddingBottom: "var(--sp-4)",
        fontSize: "var(--fs-small)",
        color: cur ? "var(--text-heading)" : "var(--text-muted)",
        fontWeight: cur ? "var(--weight-medium)" : "var(--weight-regular)"
      }
    }, s));
  }));
}
Object.assign(__ds_scope, { StepMarker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/interactive/StepMarker.jsx", error: String((e && e.message) || e) }); }

// components/shell/Footer.jsx
try { (() => {
/* Deliberately thin: one line of provenance, one link, one way up.
   No wordmark (the header already has it), no repeated glyph set. */
function Footer({
  mobile = false,
  showBackToTop = true,
  links = ["RSS"],
  style
}) {
  const linkStyle = {
    minHeight: mobile ? 44 : 0,
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "var(--font-code)",
    fontSize: "var(--fs-micro)",
    color: "var(--text-muted)",
    textDecoration: "none"
  };
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      minHeight: "var(--footer-min-h)",
      display: "flex",
      alignItems: "center",
      borderTop: "1px solid var(--border-hairline)",
      background: "var(--surface-page-alt)",
      padding: mobile ? "var(--sp-5) var(--gutter-mobile)" : "var(--sp-5) var(--gutter-desktop)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: mobile ? "column" : "row",
      alignItems: mobile ? "flex-start" : "center",
      justifyContent: "space-between",
      gap: mobile ? "var(--sp-3)" : "var(--sp-5)",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)"
    }
  }, "\xA9 2026 Lyra \xB7 example.org"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-5)"
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: linkStyle
  }, l)), showBackToTop && /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      ...linkStyle,
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "arrow-up",
    size: 13
  }), "\u56DE\u9876\u90E8"))));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/Footer.jsx", error: String((e && e.message) || e) }); }

// components/shell/GrokLauncher.jsx
try { (() => {
function GrokLauncher({
  label = null,
  mobile = false,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-label": "Ask about this article",
    style: {
      position: "absolute",
      right: "var(--fab-offset)",
      bottom: mobile ? "calc(var(--fab-offset) + env(safe-area-inset-bottom))" : "var(--fab-offset)",
      width: label ? "auto" : "var(--fab-size)",
      height: "var(--fab-size)",
      padding: label ? "0 18px 0 14px" : 0,
      gap: 8,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 25,
      cursor: "pointer",
      borderRadius: "var(--radius-pill)",
      background: "var(--accent)",
      color: "var(--on-accent)",
      border: "1px solid var(--accent)",
      boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      animation: "lyra-pulse var(--pulse-cycle) var(--ease-standard) infinite",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      letterSpacing: ".04em",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "sparkles",
    size: 19
  }), label);
}
Object.assign(__ds_scope, { GrokLauncher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/GrokLauncher.jsx", error: String((e && e.message) || e) }); }

// components/shell/GrokPanel.jsx
try { (() => {
function GrokPanel({
  messages = [],
  mobile = false,
  placeholder = "输入你的问题…",
  onClose,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: "absolute",
      zIndex: 40,
      display: "flex",
      flexDirection: "column",
      background: "var(--panel-bg)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      border: "1px solid var(--border-hairline)",
      color: "var(--text-body)",
      ...(mobile ? {
        left: 0,
        right: 0,
        bottom: 0,
        height: "85%",
        borderRadius: "var(--radius-4) var(--radius-4) 0 0",
        animation: "lyra-fade-up var(--dur-panel) var(--ease-out)"
      } : {
        right: 0,
        bottom: 0,
        top: 0,
        width: "var(--panel-w-grok)",
        animation: "lyra-slide-right var(--dur-panel) var(--ease-out)"
      }),
      ...style
    }
  }, mobile && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: "var(--border-strong)",
      margin: "var(--sp-3) auto 0"
    }
  }), /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-2)",
      padding: "var(--sp-4) var(--sp-4)",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "sparkles",
    size: 15,
    color: "var(--accent)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: "var(--fs-small)",
      color: "var(--text-heading)",
      fontWeight: "var(--weight-medium)"
    }
  }, "Ask about this article"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "\u5173\u95ED",
    style: {
      width: mobile ? 44 : 28,
      height: mobile ? 44 : 28,
      display: "grid",
      placeItems: "center",
      background: "none",
      border: 0,
      color: "var(--text-muted)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "x",
    size: 15
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "var(--sp-4)",
      display: "grid",
      gap: "var(--sp-4)",
      alignContent: "start"
    }
  }, messages.map((m, i) => {
    const me = m.role === "user";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        justifySelf: me ? "end" : "start",
        maxWidth: "86%"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-code)",
        fontSize: 10,
        letterSpacing: "var(--tracking-label)",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 5,
        textAlign: me ? "right" : "left"
      }
    }, me ? "You" : "AI"), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "10px 13px",
        borderRadius: "var(--radius-3)",
        fontSize: "var(--fs-small)",
        lineHeight: "var(--lh-body)",
        background: me ? "var(--accent)" : "var(--surface-raised)",
        color: me ? "var(--on-accent)" : "var(--text-body)",
        border: me ? "0" : "1px solid var(--border-hairline)"
      }
    }, m.text));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-2)",
      padding: "var(--sp-3)",
      borderTop: "1px solid var(--border-hairline)",
      paddingBottom: mobile ? "calc(var(--sp-3) + env(safe-area-inset-bottom))" : "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: placeholder,
    style: {
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      padding: "0 12px",
      borderRadius: "var(--radius-2)",
      background: "var(--surface-page)",
      border: "1px solid var(--border-hairline)",
      color: "var(--text-body)",
      fontFamily: "var(--font-body)",
      fontSize: "var(--fs-small)",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    style: {
      minHeight: 40
    }
  }, "\u53D1\u9001")));
}
Object.assign(__ds_scope, { GrokPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/GrokPanel.jsx", error: String((e && e.message) || e) }); }

// components/shell/ScrollProgress.jsx
try { (() => {
function ScrollProgress({
  value = 0,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      width: "100%",
      background: "transparent",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: Math.max(0, Math.min(100, value)) + "%",
      background: "var(--accent)",
      transition: "width 80ms linear"
    }
  }));
}
Object.assign(__ds_scope, { ScrollProgress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/ScrollProgress.jsx", error: String((e && e.message) || e) }); }

// components/shell/TocPanel.jsx
try { (() => {
function TocPanel({
  sections = [],
  activeIndex = 0,
  mobile = false,
  onClose,
  style
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      position: "absolute",
      zIndex: 35,
      background: "var(--panel-bg)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid var(--border-hairline)",
      color: "var(--text-body)",
      ...(mobile ? {
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "50%",
        borderRadius: "var(--radius-4) var(--radius-4) 0 0",
        padding: "var(--sp-4) var(--gutter-mobile) calc(var(--sp-6) + env(safe-area-inset-bottom))",
        animation: "lyra-fade-up var(--dur-panel) var(--ease-out)"
      } : {
        left: 0,
        top: "50%",
        transform: "translateY(-50%)",
        width: "var(--panel-w-toc)",
        borderRadius: "0 var(--radius-4) var(--radius-4) 0",
        padding: "var(--sp-5)",
        animation: "lyra-slide-left var(--dur-fast) var(--ease-out)"
      }),
      ...style
    }
  }, mobile && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: "var(--border-strong)",
      margin: "0 auto var(--sp-4)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, "\u76EE\u5F55"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "\u5173\u95ED",
    style: {
      width: mobile ? 44 : 28,
      height: mobile ? 44 : 28,
      marginRight: mobile ? -10 : -6,
      display: "grid",
      placeItems: "center",
      background: "none",
      border: 0,
      color: "var(--text-muted)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "x",
    size: 15
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-hairline)",
      margin: "var(--sp-3) 0 var(--sp-4)"
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "grid",
      gap: 2,
      overflowY: "auto"
    }
  }, sections.map((s, i) => {
    const active = i === activeIndex,
      sub = (s.level || 1) === 2;
    return /*#__PURE__*/React.createElement("a", {
      key: s.title + i,
      href: "#",
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        minHeight: mobile ? 44 : 30,
        paddingLeft: sub ? "var(--sp-5)" : 0,
        textDecoration: "none",
        fontSize: sub ? "var(--fs-micro)" : "var(--fs-small)",
        color: active ? "var(--text-heading)" : "var(--text-muted)",
        fontWeight: active ? "var(--weight-medium)" : "var(--weight-regular)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        flex: "0 0 auto",
        background: active ? "var(--accent)" : "transparent",
        border: active ? "0" : "1px solid var(--border-strong)"
      }
    }), s.title);
  })));
}
Object.assign(__ds_scope, { TocPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/TocPanel.jsx", error: String((e && e.message) || e) }); }

// components/shell/TocRail.jsx
try { (() => {
/* Collapsed TOC: one dash per section, length proportional to section size. */
function TocRail({
  sections = [],
  activeIndex = 0,
  onExpand,
  style
}) {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const max = Math.max(...sections.map(s => s.weight || 1), 1);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onExpand,
    style: {
      position: "absolute",
      left: "var(--rail-left-offset)",
      top: "50%",
      transform: "translateY(-50%)",
      display: "flex",
      flexDirection: "column",
      gap: 7,
      padding: "var(--sp-3) var(--sp-2)",
      cursor: "pointer",
      zIndex: 20,
      ...style
    }
  }, sections.map((s, i) => {
    const active = i === activeIndex,
      hot = i === hoverIdx;
    return /*#__PURE__*/React.createElement("div", {
      key: s.title + i,
      onMouseEnter: () => setHoverIdx(i),
      onMouseLeave: () => setHoverIdx(null),
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 16 + (s.weight || 1) / max * 24,
        height: active ? 3 : 2,
        borderRadius: 1,
        background: active ? "var(--accent)" : "var(--toc-line)",
        opacity: active ? 1 : hot ? .9 : .55,
        transition: "all var(--dur-fast) var(--ease-standard)"
      }
    }), hot && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 52,
        whiteSpace: "nowrap",
        padding: "4px 9px",
        borderRadius: "var(--radius-2)",
        background: "var(--panel-bg)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid var(--border-hairline)",
        fontSize: "var(--fs-micro)",
        fontFamily: "var(--font-code)",
        color: "var(--text-body)"
      }
    }, s.title));
  }));
}
Object.assign(__ds_scope, { TocRail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/TocRail.jsx", error: String((e && e.message) || e) }); }

// components/shell/UserMenu.jsx
try { (() => {
function UserMenu({
  name = "杜嘉诚",
  open = false,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggle,
    "aria-label": name,
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      cursor: "pointer",
      padding: 0,
      background: "var(--accent)",
      color: "var(--on-accent)",
      border: "1px solid var(--accent)",
      fontFamily: "var(--font-mono-display)",
      fontSize: 11,
      lineHeight: 1,
      display: "grid",
      placeItems: "center"
    }
  }, name.slice(0, 1)), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 34,
      right: 0,
      width: 172,
      zIndex: 40,
      padding: "var(--sp-3)",
      background: "var(--panel-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-3)",
      boxShadow: "0 12px 32px rgba(0,0,0,.28)",
      animation: "lyra-fade-up var(--dur-fast) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--text-heading)",
      fontWeight: "var(--weight-medium)"
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-hairline)",
      margin: "var(--sp-3) 0"
    }
  }), [["管理面板 →", true], ["登出", false]].map(([label]) => /*#__PURE__*/React.createElement("button", {
    key: label,
    type: "button",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "7px 0",
      background: "none",
      border: 0,
      cursor: "pointer",
      color: "var(--text-muted)",
      fontSize: "var(--fs-small)",
      fontFamily: "var(--font-body)"
    }
  }, label))));
}
Object.assign(__ds_scope, { UserMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/UserMenu.jsx", error: String((e && e.message) || e) }); }

// components/shell/Wordmark.jsx
try { (() => {
/* No logo binary shipped with the brief, so the mark IS the name set in the
   display mono face. Keep the diamond as a plain unicode glyph — do not draw
   a constellation. Swap in assets/logo.svg if the real mark arrives. */
function Wordmark({
  size = 16,
  showDiamond = true,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-mono-display)",
      fontSize: size,
      fontWeight: "var(--weight-medium)",
      letterSpacing: ".18em",
      color: "var(--text-heading)",
      textTransform: "uppercase",
      ...style
    }
  }, showDiamond && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)",
      fontSize: size * .8,
      letterSpacing: 0
    }
  }, "\u25C6"), "Lyra");
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/shell/Header.jsx
try { (() => {
function Header({
  nav = ["首页", "分类"],
  admin = false,
  mobile = false,
  progress = null,
  hidden = false,
  sticky = false,
  style
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: sticky ? "sticky" : "static",
      top: 0,
      zIndex: 30,
      width: "100%",
      height: mobile ? "var(--header-h-mobile)" : "var(--header-h-desktop)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: mobile ? "0 var(--gutter-mobile)" : "0 var(--gutter-desktop)",
      background: "var(--surface-page)",
      borderBottom: "1px solid var(--border-hairline)",
      transform: hidden ? "translateY(-100%)" : "none",
      transition: "transform var(--dur-fast) var(--ease-standard)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    size: mobile ? 14 : 16
  }), mobile ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "\u83DC\u5355",
    style: {
      width: 44,
      height: 44,
      marginRight: -10,
      display: "grid",
      placeItems: "center",
      background: "none",
      border: 0,
      color: "var(--text-body)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
    name: "menu",
    size: 22
  })) : /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-5)"
    }
  }, nav.map(n => /*#__PURE__*/React.createElement("a", {
    key: n,
    href: "#",
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--text-muted)",
      textDecoration: "none"
    }
  }, n)), admin ? /*#__PURE__*/React.createElement(__ds_scope.UserMenu, {
    open: menuOpen,
    onToggle: () => setMenuOpen(o => !o)
  }) : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "sm",
    icon: /*#__PURE__*/React.createElement(__ds_scope.LyraIcon, {
      name: "chevron-right",
      size: 13
    })
  }, "\u767B\u5F55")), progress != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      bottom: -1,
      height: 2,
      width: progress + "%",
      background: "var(--accent)",
      transition: "width 80ms linear"
    }
  }));
}
Object.assign(__ds_scope, { Header });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/Home.jsx
try { (() => {
const {
  Header,
  Footer,
  ArticleCard,
  Pill,
  GrokLauncher,
  Wordmark
} = window.LyraBlogDesignSystem_fbfdef;
function Home({
  mobile = false,
  admin = false,
  onOpen
}) {
  const [cat, setCat] = React.useState("全部");
  const list = window.LyraData.articles.filter(a => (admin || !a.hidden) && (cat === "全部" || a.cat === cat));
  return /*#__PURE__*/React.createElement("div", {
    "data-lyra-theme": "home",
    style: {
      position: "relative",
      minHeight: mobile ? 844 : 900,
      width: "100%",
      overflow: "hidden",
      background: "var(--surface-page)",
      color: "var(--text-body)",
      fontFamily: "var(--font-body)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(Header, {
    mobile: mobile,
    admin: admin
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      padding: mobile ? "var(--sp-7) var(--gutter-mobile) var(--sp-6)" : "var(--sp-9) var(--gutter-desktop) var(--sp-7)",
      background: "linear-gradient(180deg, var(--space-900) 0%, var(--space-850) 100%)",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono-display)",
      fontSize: mobile ? 44 : "var(--fs-hero)",
      letterSpacing: "var(--tracking-hero)",
      color: "var(--text-heading)",
      lineHeight: 1,
      animation: "lyra-fade-up var(--dur-enter) var(--ease-out)"
    }
  }, "LYRA"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      margin: "var(--sp-5) 0 var(--sp-4)"
    }
  }, [26, 14, 34, 18].map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: w,
      height: 2,
      borderRadius: 1,
      background: i === 2 ? "var(--accent)" : "var(--toc-line)"
    }
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 var(--sp-6)",
      fontSize: mobile ? "var(--fs-small)" : "var(--fs-lead)",
      color: "var(--text-muted)"
    }
  }, "A place for thinking out loud."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-2)",
      overflowX: mobile ? "auto" : "visible",
      paddingBottom: mobile ? 4 : 0
    }
  }, window.LyraData.cats.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: c === cat,
    onClick: () => setCat(c)
  }, c)))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: mobile ? "var(--sp-5) var(--gutter-mobile) var(--sp-8)" : "var(--sp-7) var(--gutter-desktop) var(--sp-9)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      columns: mobile ? 1 : 3,
      columnGap: "var(--sp-5)"
    }
  }, list.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      breakInside: "avoid",
      marginBottom: "var(--sp-5)"
    }
  }, /*#__PURE__*/React.createElement(ArticleCard, {
    variant: mobile ? i === 0 ? "default" : "row" : a.cover ? "cover" : "default",
    feature: !mobile && a.feature,
    hidden: a.hidden,
    category: a.cat,
    date: a.date,
    title: a.title,
    summary: a.summary,
    tags: a.tags,
    readTime: a.read,
    onClick: () => a.screen && onOpen && onOpen(a.screen)
  })))))), /*#__PURE__*/React.createElement(Footer, {
    mobile: mobile,
    showBackToTop: false
  }), /*#__PURE__*/React.createElement(GrokLauncher, {
    mobile: mobile,
    label: mobile ? null : "Ask"
  }));
}
Object.assign(window, {
  Home
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/PageShell.jsx
try { (() => {
const {
  Header,
  Footer,
  TocRail,
  TocPanel,
  GrokLauncher,
  GrokPanel
} = window.LyraBlogDesignSystem_fbfdef;
const {
  LyraIcon
} = window.LyraBlogDesignSystem_fbfdef;
function PageShell({
  theme,
  mobile,
  admin,
  sections = [],
  activeIndex = 0,
  progress = null,
  article = true,
  children,
  onHome
}) {
  const [tocOpen, setTocOpen] = React.useState(false);
  const [grokOpen, setGrokOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    "data-lyra-theme": theme,
    style: {
      position: "relative",
      minHeight: mobile ? 844 : 900,
      width: "100%",
      overflow: "hidden",
      background: "var(--surface-page)",
      color: "var(--text-body)",
      fontFamily: "var(--font-body)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onHome
  }, /*#__PURE__*/React.createElement(Header, {
    mobile: mobile,
    admin: admin,
    sticky: article,
    progress: article ? progress ?? 38 : null
  })), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      position: "relative"
    }
  }, children), /*#__PURE__*/React.createElement(Footer, {
    mobile: mobile
  }), article && sections.length > 0 && (mobile ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTocOpen(true),
    style: {
      position: "absolute",
      left: "var(--gutter-mobile)",
      bottom: "calc(var(--fab-offset) + env(safe-area-inset-bottom))",
      height: 44,
      padding: "0 16px",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      zIndex: 24,
      cursor: "pointer",
      borderRadius: "var(--radius-pill)",
      background: "var(--surface-raised)",
      color: "var(--text-body)",
      border: "1px solid var(--border-strong)",
      boxShadow: "0 6px 20px rgba(0,0,0,.24)",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)"
    }
  }, /*#__PURE__*/React.createElement(LyraIcon, {
    name: "list",
    size: 15
  }), "\u76EE\u5F55") : /*#__PURE__*/React.createElement(TocRail, {
    sections: sections,
    activeIndex: activeIndex,
    onExpand: () => setTocOpen(true)
  })), tocOpen && /*#__PURE__*/React.createElement(TocPanel, {
    sections: sections,
    activeIndex: activeIndex,
    mobile: mobile,
    onClose: () => setTocOpen(false)
  }), !grokOpen && /*#__PURE__*/React.createElement(GrokLauncher, {
    mobile: mobile,
    onClick: () => setGrokOpen(true)
  }), grokOpen && /*#__PURE__*/React.createElement(GrokPanel, {
    messages: window.LyraData.grok,
    mobile: mobile,
    onClose: () => setGrokOpen(false)
  }));
}

/* Centred reading column. */
function Measure({
  width = "var(--measure-tech)",
  mobile,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: width,
      margin: "0 auto",
      padding: mobile ? "var(--sp-6) var(--gutter-mobile) var(--sp-8)" : "var(--sp-8) var(--gutter-desktop) var(--sp-9)",
      ...style
    }
  }, children);
}
function H2({
  children,
  mono
}) {
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "var(--sp-8) 0 var(--sp-4)",
      fontSize: "var(--fs-h2)",
      fontFamily: mono ? "var(--font-mono-display)" : undefined,
      fontWeight: 600
    }
  }, children);
}
function P({
  children,
  essay,
  style
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 var(--sp-4)",
      fontSize: essay ? "var(--fs-body-essay)" : "var(--fs-body)",
      lineHeight: essay ? "var(--lh-essay)" : "var(--lh-body)",
      ...style
    }
  }, children);
}
Object.assign(window, {
  PageShell,
  Measure,
  H2,
  P
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/PageShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/TemplateData.jsx
try { (() => {
const {
  ArticleHeader,
  StatCard,
  BarChartRow,
  ComparisonTable,
  ChartFrame,
  Sidenote,
  SectionBreak
} = window.LyraBlogDesignSystem_fbfdef;
function TemplateData({
  mobile = false,
  admin = false,
  onHome
}) {
  return /*#__PURE__*/React.createElement(PageShell, {
    theme: "data",
    mobile: mobile,
    admin: admin,
    sections: window.LyraData.sections.data,
    activeIndex: 0,
    progress: 18,
    onHome: onHome
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      padding: mobile ? "var(--sp-6) var(--gutter-mobile)" : "var(--sp-8) var(--gutter-desktop)",
      background: "linear-gradient(180deg, #ebf4fd 0%, var(--data-bg) 100%)",
      borderBottom: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--measure-data)",
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: mobile ? 28 : "var(--fs-title)",
      fontWeight: 700
    }
  }, "\u6B27\u6D32\u5404\u56FD\u535A\u58EB\u7A0E\u540E\u5DE5\u8D44"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "var(--sp-3) 0 var(--sp-6)",
      color: "var(--text-muted)",
      fontSize: "var(--fs-lead)"
    }
  }, "\u4E00\u4EFD\u6765\u81EA\u771F\u5B9E\u6570\u636E\u7684\u6A2A\u5411\u5BF9\u6BD4 \xB7 15 \u4E2A\u56FD\u5BB6"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)",
      gap: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: "\u20AC2,400",
    label: "\u6700\u9AD8\u6027\u4EF7\u6BD4",
    note: "\u8377\u5170 \xB7 \u51C0\u5269 \u20AC1,350"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "\u20AC4,200",
    label: "\u6700\u9AD8\u7EDD\u5BF9\u503C",
    note: "\u745E\u58EB \xB7 \u82CF\u9ECE\u4E16",
    tone: "accent"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "\u20AC2,100",
    label: "\u6700\u5927\u535A\u58EB\u7FA4\u4F53",
    note: "\u5FB7\u56FD \xB7 \u7EA6 20 \u4E07\u4EBA"
  })))), /*#__PURE__*/React.createElement(Measure, {
    width: "var(--measure-data)",
    mobile: mobile
  }, /*#__PURE__*/React.createElement(H2, null, "\u85AA\u8D44\u603B\u89C8"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(P, null, "\u4E0B\u9762\u662F\u5404\u56FD\u535A\u58EB\u7B2C\u4E00\u5E74\u7684\u7A0E\u540E\u6708\u85AA\u4E2D\u4F4D\u6570\u3002\u745E\u58EB\u7684\u7EDD\u5BF9\u503C\u9AD8\u51FA\u4E00\u6863\uFF0C\u4F46\u5B83\u7684\u623F\u79DF\u4E5F\u662F\u3002"), !mobile && /*#__PURE__*/React.createElement(Sidenote, {
    marker: "1"
  }, "\u6570\u636E\u53D6\u81EA 2025 \u5E74\u5404\u6821\u516C\u5F00\u85AA\u8D44\u8868\u4E0E EURAXESS \u6C47\u603B\u3002")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "var(--sp-5) 0"
    }
  }, /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u745E\u58EB",
    value: 4200,
    max: 4200,
    display: "\u20AC4,200"
  }), /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u4E39\u9EA6",
    value: 3100,
    max: 4200,
    display: "\u20AC3,100",
    tone: "quiet"
  }), /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u8377\u5170",
    value: 2400,
    max: 4200,
    display: "\u20AC2,400",
    tone: "up"
  }), /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u5FB7\u56FD",
    value: 2100,
    max: 4200,
    display: "\u20AC2,100",
    tone: "quiet"
  }), /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u6CD5\u56FD",
    value: 1900,
    max: 4200,
    display: "\u20AC1,900",
    tone: "quiet"
  }), /*#__PURE__*/React.createElement(BarChartRow, {
    label: "\u897F\u73ED\u7259",
    value: 1450,
    max: 4200,
    display: "\u20AC1,450",
    tone: "down"
  })), /*#__PURE__*/React.createElement(H2, null, "\u751F\u6D3B\u6210\u672C\u5BF9\u6BD4"), /*#__PURE__*/React.createElement(ComparisonTable, {
    columns: ["国家", "月薪", "房租", "净剩", "评分"],
    rows: [["瑞士", "€4,200", "€1,500", "€2,700", "★★★★"], ["丹麦", "€3,100", "€1,150", "€1,950", "★★★★"], ["荷兰", "€2,400", "€1,050", "€1,350", "★★★★"], ["德国", "€2,100", "€850", "€1,250", "★★★"], ["法国", "€1,900", "€900", "€1,000", "★★"], ["西班牙", "€1,450", "€700", "€750", "★★"]]
  }), /*#__PURE__*/React.createElement(SectionBreak, {
    variant: "rule"
  }), /*#__PURE__*/React.createElement(H2, null, "\u51C0\u5269\u4E0E\u6027\u4EF7\u6BD4"), /*#__PURE__*/React.createElement(ChartFrame, {
    title: "\u6708\u85AA vs \u623F\u79DF \xB7 \u6563\u70B9",
    note: "\u6570\u636E: 2025 \xB7 n=15",
    height: mobile ? 220 : 300
  })));
}
Object.assign(window, {
  TemplateData
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/TemplateData.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/TemplateEssay.jsx
try { (() => {
const {
  ArticleHeader,
  PullQuote,
  SectionBreak,
  Sidenote
} = window.LyraBlogDesignSystem_fbfdef;
function TemplateEssay({
  mobile = false,
  admin = false,
  onHome
}) {
  return /*#__PURE__*/React.createElement(PageShell, {
    theme: "essay",
    mobile: mobile,
    admin: admin,
    sections: window.LyraData.sections.essay,
    activeIndex: 1,
    progress: 52,
    onHome: onHome
  }, /*#__PURE__*/React.createElement(Measure, {
    width: "var(--measure-essay)",
    mobile: mobile
  }, /*#__PURE__*/React.createElement(ArticleHeader, {
    align: "center",
    serif: true,
    title: "\u5730\u6CFD\u4E34",
    meta: ["2026 年 8 月", "某个安静的下午"]
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 var(--sp-5)",
      fontSize: "var(--fs-body-essay)",
      lineHeight: "var(--lh-essay)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      float: "left",
      fontFamily: "var(--font-serif-cjk)",
      fontSize: 68,
      lineHeight: .82,
      paddingRight: 12,
      paddingTop: 6,
      color: "var(--accent)"
    }
  }, "\u4E34"), "\u5366\u540D\u4ECE\u6C34\u8FB9\u6765\u3002\u6CFD\u5728\u4E0B\uFF0C\u5730\u5728\u4E0A\uFF0C\u6C34\u6C14\u5347\u5230\u571F\u91CC\u53BB\uFF0C\u8349\u5C31\u957F\u8D77\u6765\u4E86\u3002\u5360\u5230\u8FD9\u4E00\u5366\u7684\u90A3\u5929\u5348\u540E\u5F88\u5B89\u9759\uFF0C\u98CE\u4ECE\u6C34\u9762\u8FC7\u53BB\uFF0C\u4EC0\u4E48\u4E5F\u6CA1\u5E26\u8D70\uFF0C\u53EA\u628A\u5149\u632A\u4E86\u534A\u5BF8\u3002"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(P, {
    essay: true
  }, "\u6211\u4E0D\u592A\u4FE1\u5360\u535C\u80FD\u9884\u8A00\u4EC0\u4E48\uFF0C\u4F46\u6211\u4FE1\u5B83\u80FD\u8BA9\u4EBA\u628A\u95EE\u9898\u8BF4\u6E05\u695A\u2014\u2014\u4F60\u5F97\u5148\u628A\u60F3\u95EE\u7684\u4E8B\u60C5\u5199\u4E0B\u6765\uFF0C\u624D\u597D\u6447\u90A3\u516D\u6B21\u3002\u5199\u7684\u8FC7\u7A0B\u91CC\uFF0C\u591A\u534A\u5C31\u5DF2\u7ECF\u77E5\u9053\u7B54\u6848\u3002"), !mobile && /*#__PURE__*/React.createElement(Sidenote, {
    marker: "1"
  }, "\u300A\u5468\u6613\u300B\u4E34\u5366\uFF0C\u5151\u4E0B\u5764\u4E0A\u3002")), /*#__PURE__*/React.createElement(PullQuote, {
    cite: "\u6613 \xB7 \u4E34\u5366"
  }, "\u6CFD\u4E0A\u6709\u5730\uFF0C\u4E34\u3002\u541B\u5B50\u4EE5\u6559\u601D\u65E0\u7A77\uFF0C\u5BB9\u4FDD\u6C11\u65E0\u7586\u3002"), /*#__PURE__*/React.createElement(P, {
    essay: true
  }, "\u300C\u6559\u601D\u65E0\u7A77\u300D\u8FD9\u56DB\u4E2A\u5B57\uFF0C\u843D\u5230\u4E00\u4E2A\u505A\u751F\u7269\u4FE1\u606F\u7684\u4EBA\u8EAB\u4E0A\uFF0C\u5927\u6982\u5C31\u662F\uFF1A\u4E0D\u8981\u56E0\u4E3A\u6D41\u6C34\u7EBF\u8DD1\u901A\u4E86\u5C31\u505C\u4E0B\u6765\u60F3\u3002\u7BA1\u5B50\u63A5\u597D\u4E86\uFF0C\u6C34\u4F1A\u81EA\u5DF1\u6D41\uFF0C\u4F46\u6C34\u91CC\u6709\u4EC0\u4E48\uFF0C\u8FD8\u662F\u5F97\u81EA\u5DF1\u53BB\u770B\u3002"), /*#__PURE__*/React.createElement(SectionBreak, null), /*#__PURE__*/React.createElement(P, {
    essay: true
  }, "\u540E\u6765\u90A3\u652F\u5366\u7684\u7B54\u6848\u6CA1\u6709\u5E94\u9A8C\uFF0C\u4E5F\u6CA1\u6709\u843D\u7A7A\u3002\u5B83\u53EA\u662F\u8BA9\u90A3\u4E2A\u4E0B\u5348\u53D8\u5F97\u53EF\u4EE5\u88AB\u8BB0\u4F4F\u2014\u2014\u8FD9\u5DF2\u7ECF\u6BD4\u5927\u591A\u6570\u4E0B\u5348\u505A\u5F97\u66F4\u591A\u4E86\u3002")));
}
Object.assign(window, {
  TemplateEssay
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/TemplateEssay.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/TemplateMagazine.jsx
try { (() => {
const {
  FigureImage,
  PullQuote,
  Tag
} = window.LyraBlogDesignSystem_fbfdef;
const {
  LyraIcon
} = window.LyraBlogDesignSystem_fbfdef;
function TemplateMagazine({
  mobile = false,
  admin = false,
  onHome
}) {
  return /*#__PURE__*/React.createElement(PageShell, {
    theme: "magazine",
    mobile: mobile,
    admin: admin,
    sections: window.LyraData.sections.magazine,
    activeIndex: 1,
    progress: 44,
    onHome: onHome
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      height: mobile ? 560 : 760,
      background: "var(--surface-inset)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "#3a3a3a"
    }
  }, "full-bleed cover image"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 45%, #000 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      textAlign: "center",
      padding: "0 var(--gutter-mobile)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono-display)",
      fontSize: 11,
      letterSpacing: "var(--tracking-label)",
      color: "var(--accent)",
      marginBottom: "var(--sp-4)"
    }
  }, "2026 \xB7 ANNUAL REVIEW"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-serif-display)",
      fontSize: mobile ? 40 : 76,
      lineHeight: 1.05,
      color: "var(--text-heading)",
      fontWeight: 400
    }
  }, "A Year of", /*#__PURE__*/React.createElement("br", null), "Quiet Work")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 28,
      left: 0,
      right: 0,
      display: "grid",
      placeItems: "center",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement(LyraIcon, {
    name: "chevron-down",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--measure-magazine)",
      margin: "0 auto",
      padding: mobile ? "var(--sp-7) var(--gutter-mobile)" : "var(--sp-9) var(--gutter-desktop)"
    }
  }, /*#__PURE__*/React.createElement(P, {
    style: {
      fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)",
      lineHeight: 1.75
    }
  }, "\u4ECA\u5E74\u505A\u5B8C\u7684\u4E8B\u60C5\u6BD4\u9884\u60F3\u7684\u5C11\uFF0C\u7559\u4E0B\u6765\u7684\u6BD4\u9884\u60F3\u7684\u591A\u3002\u4E09\u6708\u5728\u5B9E\u9A8C\u5BA4\u5F85\u4E86\u6574\u6574\u4E00\u4E2A\u6708\uFF0C\u51FA\u6765\u7684\u65F6\u5019\u6A31\u82B1\u5DF2\u7ECF\u843D\u5B8C\u4E86\uFF1B\u516B\u6708\u5F00\u59CB\u5199\u8FD9\u4E2A\u535A\u5BA2\uFF0C\u628A\u8FC7\u53BB\u4E24\u5E74\u6563\u5728\u5404\u5904\u7684\u7B14\u8BB0\u642C\u8FDB\u6765\u3002"), /*#__PURE__*/React.createElement(P, {
    style: {
      fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)",
      lineHeight: 1.75
    }
  }, "\u56DE\u5934\u770B\uFF0C\u503C\u5F97\u5199\u4E0B\u6765\u7684\u90FD\u4E0D\u662F\u7ED3\u679C\uFF0C\u662F\u90A3\u4E9B\u5B89\u9759\u7684\u3001\u91CD\u590D\u7684\u3001\u5F53\u65F6\u89C9\u5F97\u6BEB\u65E0\u8FDB\u5C55\u7684\u4E0B\u5348\u3002")), /*#__PURE__*/React.createElement(FigureImage, {
    bleed: true,
    ratio: mobile ? "4 / 3" : "21 / 9",
    caption: "Krak\xF3w\uFF0C\u4E09\u6708"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "var(--measure-magazine)",
      margin: "0 auto",
      padding: mobile ? "0 var(--gutter-mobile)" : "0 var(--gutter-desktop)"
    }
  }, /*#__PURE__*/React.createElement(PullQuote, {
    variant: "display",
    cite: "\u516B\u6708"
  }, "\u5199\u7ED9\u81EA\u5DF1\u7684\u7B14\u8BB0\u672C\uFF0C\u6070\u597D\u653E\u5728\u516C\u5F00\u7684\u5730\u65B9\u3002"), /*#__PURE__*/React.createElement(P, {
    style: {
      fontSize: mobile ? "var(--fs-body)" : "var(--fs-body-essay)",
      lineHeight: 1.75
    }
  }, "\u660E\u5E74\u60F3\u628A\u4EA4\u4E92\u6587\u7AE0\u505A\u6210\u9ED8\u8BA4\u5F62\u6001\uFF1A\u80FD\u62D6\u7684\u4E1C\u897F\uFF0C\u6BD4\u80FD\u8BFB\u7684\u4E1C\u897F\u7559\u5F97\u4E45\u3002"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-4)",
      margin: "var(--sp-7) 0 var(--sp-9)",
      paddingTop: "var(--sp-4)",
      borderTop: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    dot: true,
    tone: "accent"
  }, "\u968F\u7B14"), /*#__PURE__*/React.createElement(Tag, null, "#\u5E74\u5EA6\u603B\u7ED3"))));
}
Object.assign(window, {
  TemplateMagazine
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/TemplateMagazine.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/TemplateTech.jsx
try { (() => {
const {
  ArticleHeader,
  CodeBlock,
  Callout,
  MathBlock,
  PullQuote,
  FigureImage,
  Tag
} = window.LyraBlogDesignSystem_fbfdef;
function TemplateTech({
  mobile = false,
  admin = false,
  onHome
}) {
  return /*#__PURE__*/React.createElement(PageShell, {
    theme: "tech",
    mobile: mobile,
    admin: admin,
    sections: window.LyraData.sections.tech,
    activeIndex: 1,
    progress: 34,
    onHome: onHome
  }, /*#__PURE__*/React.createElement(Measure, {
    width: "var(--measure-tech)",
    mobile: mobile
  }, /*#__PURE__*/React.createElement(ArticleHeader, {
    kicker: "Deep technical",
    title: "\u4F7F\u7528 Flow Matching \u8BAD\u7EC3 3D \u4EBA\u8138\u751F\u6210\u5668",
    meta: ["Lyra", "2026-08-20", "15 min read"]
  }), /*#__PURE__*/React.createElement(H2, {
    mono: true
  }, "\u95EE\u9898\u80CC\u666F"), /*#__PURE__*/React.createElement(P, null, "\u6269\u6563\u6A21\u578B\u5728 3D \u4E0A\u7684\u4E3B\u8981\u75DB\u70B9\u4E0D\u662F\u8D28\u91CF\uFF0C\u800C\u662F\u91C7\u6837\u6210\u672C\uFF1A\u4E00\u4E2A 512\xB3 \u7684\u4F53\u7D20\u7F51\u683C\u4E0A\u8DD1 250 \u6B65\u53BB\u566A\uFF0C\u5355\u5F20\u5361\u8981\u51E0\u5341\u79D2\u3002Flow matching \u628A\u751F\u6210\u8FC7\u7A0B\u91CD\u5199\u6210\u4E00\u6761\u5E38\u5FAE\u5206\u65B9\u7A0B\uFF0C\u8BAD\u7EC3\u76EE\u6807\u4ECE\"\u9884\u6D4B\u566A\u58F0\"\u53D8\u6210\"\u9884\u6D4B\u901F\u5EA6\u573A\"\uFF0C\u91C7\u6837\u6B65\u6570\u56E0\u6B64\u53EF\u4EE5\u538B\u5230\u5341\u51E0\u6B65\u3002"), /*#__PURE__*/React.createElement(CodeBlock, {
    lang: "python",
    code: "import torch\n\ndef flow_matching_target(x0, x1, t):\n    \"\"\"x0: 噪声  x1: 数据  t: [B, 1]\"\"\"\n    xt = (1 - t) * x0 + t * x1\n    vt = x1 - x0            # 恒定速度场\n    return xt, vt"
  }), /*#__PURE__*/React.createElement(Callout, {
    kind: "tip"
  }, "\u5148\u7528 128\xB3 \u4F53\u7D20\u628A\u6574\u6761\u94FE\u8DEF\u8DD1\u901A\uFF0C\u518D\u8003\u8651\u5206\u8FA8\u7387\u3002"), /*#__PURE__*/React.createElement(H2, {
    mono: true
  }, "\u6570\u5B66\u63A8\u5BFC"), /*#__PURE__*/React.createElement(P, null, "\u7ED9\u5B9A\u4E00\u5BF9\u6837\u672C ", /*#__PURE__*/React.createElement("code", null, "(x\u2080, x\u2081)"), "\uFF0C\u6211\u4EEC\u53EA\u9700\u8BA9\u7F51\u7EDC\u5728\u63D2\u503C\u70B9\u4E0A\u56DE\u5F52\u6052\u5B9A\u901F\u5EA6\uFF1A"), /*#__PURE__*/React.createElement(MathBlock, {
    tex: "dx/dt = v_\u03B8(x, t),   L = E\u2016v_\u03B8(x\u209C, t) \u2212 (x\u2081 \u2212 x\u2080)\u2016\xB2",
    label: "(1)"
  }), /*#__PURE__*/React.createElement(P, null, "\u8FD9\u6761\u635F\u5931\u6CA1\u6709\u566A\u58F0\u8C03\u5EA6\u8868\uFF0C\u4E5F\u6CA1\u6709 SNR \u6743\u91CD\u9700\u8981\u8C03\u2014\u2014\u8FD9\u662F\u5B83\u6700\u7701\u5FC3\u7684\u5730\u65B9\u3002"), /*#__PURE__*/React.createElement(Callout, {
    kind: "warning"
  }, "\u5728 float16 \u4E0B\u901F\u5EA6\u573A\u7684\u65B9\u5DEE\u4F1A\u88AB\u622A\u65AD\uFF0C\u8BAD\u7EC3\u4E2D\u671F\u5BB9\u6613\u584C\u5230\u5747\u503C\u8138\u3002"), /*#__PURE__*/React.createElement(H2, {
    mono: true
  }, "\u5B9E\u9A8C\u7ED3\u679C"), /*#__PURE__*/React.createElement(P, null, "\u5728 8k \u5F20\u626B\u63CF\u4EBA\u8138\u4E0A\u8BAD\u7EC3 40 \u4E2A epoch\uFF0C16 \u6B65\u91C7\u6837\u7684 FID \u5DF2\u7ECF\u63A5\u8FD1 250 \u6B65\u7684\u6269\u6563\u57FA\u7EBF\u3002"), /*#__PURE__*/React.createElement(FigureImage, {
    ratio: "16 / 9",
    caption: "\u56FE 1 \xB7 16 \u6B65 vs 250 \u6B65\u91C7\u6837\u7684\u901F\u5EA6\u573A\u8F68\u8FF9"
  }), /*#__PURE__*/React.createElement(PullQuote, {
    cite: "\u8BAD\u7EC3\u65E5\u5FD7 \xB7 \u7B2C 31 epoch"
  }, "\u628A\u91C7\u6837\u6B65\u6570\u5199\u8FDB checkpoint \u7684\u5143\u6570\u636E\uFF0C\u5426\u5219\u4E09\u4E2A\u6708\u540E\u4F60\u4E0D\u4F1A\u8BB0\u5F97\u8FD9\u6761\u66F2\u7EBF\u662F\u51E0\u6B65\u8DD1\u51FA\u6765\u7684\u3002"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-4)",
      marginTop: "var(--sp-7)",
      paddingTop: "var(--sp-4)",
      borderTop: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    dot: true,
    tone: "accent"
  }, "\u6280\u672F"), /*#__PURE__*/React.createElement(Tag, null, "#\u751F\u6210\u6A21\u578B"), /*#__PURE__*/React.createElement(Tag, null, "#PyTorch"))));
}
Object.assign(window, {
  TemplateTech
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/TemplateTech.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/TemplateTutorial.jsx
try { (() => {
const {
  ArticleHeader,
  DemoPanel,
  SliderControl,
  Playground,
  StepMarker,
  Callout,
  Button,
  LyraIcon
} = window.LyraBlogDesignSystem_fbfdef;
function TemplateTutorial({
  mobile = false,
  admin = false,
  onHome
}) {
  const [sigma, setSigma] = React.useState(0.7);
  return /*#__PURE__*/React.createElement(PageShell, {
    theme: "tutorial",
    mobile: mobile,
    admin: admin,
    sections: window.LyraData.sections.tutorial,
    activeIndex: 0,
    progress: 26,
    onHome: onHome
  }, /*#__PURE__*/React.createElement(Measure, {
    width: "var(--measure-tutorial)",
    mobile: mobile
  }, /*#__PURE__*/React.createElement(ArticleHeader, {
    kicker: "Interactive tutorial",
    title: "\u7406\u89E3\u6269\u6563\u6A21\u578B\u7684\u53BB\u566A\u8FC7\u7A0B",
    meta: ["Lyra", "2026-08-12", "12 min · 3 个可交互组件"]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "150px 1fr",
      gap: "var(--sp-6)"
    }
  }, !mobile && /*#__PURE__*/React.createElement(StepMarker, {
    steps: ["添加噪声", "学习逆过程", "采样与评估"],
    active: 0,
    style: {
      position: "sticky",
      top: 96,
      alignSelf: "start"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(H2, null, "Step 1 \xB7 \u6DFB\u52A0\u566A\u58F0"), /*#__PURE__*/React.createElement(P, null, "\u524D\u5411\u8FC7\u7A0B\u53EA\u6709\u4E00\u4E2A\u81EA\u7531\u5EA6\uFF1A\u566A\u58F0\u5F3A\u5EA6 \u03C3\u3002\u628A\u6ED1\u5757\u62C9\u5230\u5E95\uFF0C\u56FE\u50CF\u5C31\u9000\u5316\u6210\u7EAF\u9AD8\u65AF\u566A\u58F0\uFF1B\u6A21\u578B\u8981\u5B66\u7684\u662F\u8FD9\u6761\u8DEF\u7684\u53CD\u65B9\u5411\u3002"), /*#__PURE__*/React.createElement(DemoPanel, {
    title: "\u62D6\u52A8\u770B\u6548\u679C"
  }, /*#__PURE__*/React.createElement(SliderControl, {
    label: "\u566A\u58F0\u5F3A\u5EA6 \u03C3",
    value: sigma,
    onChange: setSigma
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--sp-3)",
      height: mobile ? 120 : 160,
      borderRadius: "var(--radius-2)",
      background: "var(--surface-inset)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-code)",
      fontSize: "var(--fs-micro)",
      color: "var(--text-muted)",
      filter: "blur(" + (sigma * 6).toFixed(1) + "px)"
    }
  }, "canvas \xB7 \u5B9E\u65F6\u566A\u58F0\u53EF\u89C6\u5316"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--sp-2)",
      marginTop: "var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: /*#__PURE__*/React.createElement(LyraIcon, {
      name: "play",
      size: 12,
      color: "var(--on-accent)"
    })
  }, "\u8FD0\u884C\u52A8\u753B"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => setSigma(0.7)
  }, "\u91CD\u7F6E"))), /*#__PURE__*/React.createElement(Callout, {
    kind: "best"
  }, "\u628A \u03C3 \u7684\u53D6\u503C\u8303\u56F4\u5199\u5728\u7EC4\u4EF6\u65C1\u8FB9\uFF0C\u8BFB\u8005\u624D\u77E5\u9053\u81EA\u5DF1\u5728\u4EC0\u4E48\u533A\u95F4\u91CC\u73A9\u3002"), /*#__PURE__*/React.createElement(H2, null, "Step 2 \xB7 \u5B66\u4E60\u9006\u8FC7\u7A0B"), /*#__PURE__*/React.createElement(P, null, "\u4E0B\u9762\u8FD9\u6BB5\u53EF\u4EE5\u76F4\u63A5\u6539\uFF1A\u628A ", /*#__PURE__*/React.createElement("code", null, "steps"), " \u8C03\u5C0F\uFF0C\u89C2\u5BDF\u8F93\u51FA\u5F20\u91CF\u7684\u65B9\u5DEE\u5982\u4F55\u53D8\u5316\u3002"), /*#__PURE__*/React.createElement(Playground, {
    lang: "Python",
    code: "import torch\n\nsteps = 16\nx = torch.randn(3)\nfor t in torch.linspace(1, 0, steps):\n    x = x - (1 / steps) * x\nprint(x)",
    output: "tensor([0.1234, -1.0213, 0.5507])"
  })))));
}
Object.assign(window, {
  TemplateTutorial
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/TemplateTutorial.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/data.js
try { (() => {
window.LyraData = {
  articles: [{
    id: "phd-salary",
    cat: "研究",
    date: "08/21",
    title: "欧洲各国博士税后工资",
    summary: "15 个国家的横向对比：月薪、房租、净剩与一点主观评分。",
    tags: ["留学", "博士"],
    read: "8 min",
    screen: "data",
    feature: true
  }, {
    id: "flow-matching",
    cat: "技术",
    date: "08/18",
    title: "使用 Flow Matching 训练 3D 人脸生成器",
    summary: "从一条常微分方程到能跑的训练脚本。",
    tags: ["生成模型", "PyTorch"],
    read: "15 min",
    screen: "tech",
    cover: true
  }, {
    id: "lin-gua",
    cat: "文化",
    date: "08/20",
    title: "地泽临",
    summary: "一个下午，和一支卦。",
    tags: ["易", "随笔"],
    read: "6 min",
    screen: "essay",
    hidden: true
  }, {
    id: "diffusion-tutorial",
    cat: "技术",
    date: "08/12",
    title: "理解扩散模型的去噪过程",
    summary: "三个可拖动的小组件，比三页公式管用。",
    tags: ["扩散模型", "交互"],
    read: "12 min",
    screen: "tutorial"
  }, {
    id: "year-2026",
    cat: "随笔",
    date: "08/02",
    title: "A Year of Quiet Work",
    summary: "2026 年度回顾，图比字多。",
    tags: ["年度总结"],
    read: "9 min",
    screen: "magazine",
    cover: true
  }, {
    id: "nextflow",
    cat: "技术",
    date: "07/28",
    title: "把 Nextflow 跑在一台机器上",
    summary: "生信流水线的最小可用配置。",
    tags: ["生信", "工程"],
    read: "3 min"
  }, {
    id: "seq-notes",
    cat: "研究",
    date: "07/19",
    title: "单细胞测序的三个坑",
    summary: "批次效应、双细胞、以及过度解释。",
    tags: ["单细胞"],
    read: "7 min"
  }],
  cats: ["全部", "研究", "技术", "文化", "随笔"],
  sections: {
    tech: [{
      title: "问题背景",
      weight: 2
    }, {
      title: "方法",
      weight: 3
    }, {
      title: "数学推导",
      weight: 2,
      level: 2
    }, {
      title: "实现细节",
      weight: 2,
      level: 2
    }, {
      title: "实验结果",
      weight: 2
    }, {
      title: "讨论与展望",
      weight: 1
    }, {
      title: "参考文献",
      weight: 1
    }],
    data: [{
      title: "薪资总览",
      weight: 3
    }, {
      title: "生活成本对比",
      weight: 2
    }, {
      title: "净剩与性价比",
      weight: 2
    }, {
      title: "方法与数据来源",
      weight: 1
    }],
    essay: [{
      title: "临",
      weight: 2
    }, {
      title: "泽上有地",
      weight: 2
    }, {
      title: "午后",
      weight: 1
    }],
    tutorial: [{
      title: "Step 1 · 添加噪声",
      weight: 2
    }, {
      title: "Step 2 · 学习逆过程",
      weight: 3
    }, {
      title: "Step 3 · 采样",
      weight: 2
    }],
    magazine: [{
      title: "封面",
      weight: 1
    }, {
      title: "春",
      weight: 2
    }, {
      title: "夏",
      weight: 2
    }, {
      title: "秋与冬",
      weight: 3
    }]
  },
  grok: [{
    role: "ai",
    text: "这篇文章讲述了欧洲各国博士的税后工资对比，覆盖 15 个国家。"
  }, {
    role: "user",
    text: "德国和荷兰哪个工资更高？"
  }, {
    role: "ai",
    text: "荷兰的博士月薪约 €2,400，德国约 €2,100；但把房租算进去，两者的净剩差距会缩小到 €100 上下。"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/data.js", error: String((e && e.message) || e) }); }

__ds_ns.ArticleHeader = __ds_scope.ArticleHeader;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.CodeBlock = __ds_scope.CodeBlock;

__ds_ns.FigureImage = __ds_scope.FigureImage;

__ds_ns.MathBlock = __ds_scope.MathBlock;

__ds_ns.PullQuote = __ds_scope.PullQuote;

__ds_ns.SectionBreak = __ds_scope.SectionBreak;

__ds_ns.Sidenote = __ds_scope.Sidenote;

__ds_ns.ArticleCard = __ds_scope.ArticleCard;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.BarChartRow = __ds_scope.BarChartRow;

__ds_ns.ChartFrame = __ds_scope.ChartFrame;

__ds_ns.ComparisonTable = __ds_scope.ComparisonTable;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.LyraIcon = __ds_scope.LyraIcon;

__ds_ns.DemoPanel = __ds_scope.DemoPanel;

__ds_ns.Playground = __ds_scope.Playground;

__ds_ns.SliderControl = __ds_scope.SliderControl;

__ds_ns.StepMarker = __ds_scope.StepMarker;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.GrokLauncher = __ds_scope.GrokLauncher;

__ds_ns.GrokPanel = __ds_scope.GrokPanel;

__ds_ns.Header = __ds_scope.Header;

__ds_ns.ScrollProgress = __ds_scope.ScrollProgress;

__ds_ns.TocPanel = __ds_scope.TocPanel;

__ds_ns.TocRail = __ds_scope.TocRail;

__ds_ns.UserMenu = __ds_scope.UserMenu;

__ds_ns.Wordmark = __ds_scope.Wordmark;

})();
