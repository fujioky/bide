/* ── Lyra DS 运行时 ───────────────────────────────────────────────
   设计系统的组件只定义了外观。这一层把行为补上：
   代码高亮、复制、图片查看器、古文引用字体。
   对 React 渲染的卡片和静态文章页同样生效。
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ══ 1. 代码高亮 ══ */
  var GRAMMAR = {
    python: {
      kw: /\b(def|class|return|import|from|as|if|elif|else|for|while|in|not|and|or|is|None|True|False|with|try|except|finally|raise|yield|lambda|global|pass|break|continue|assert|async|await)\b/,
      builtin: /\b(print|len|range|str|int|float|list|dict|set|tuple|super|self|torch|np|open|enumerate|zip|map|filter|sum|min|max|abs)\b/
    },
    javascript: {
      kw: /\b(const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|null|undefined|true|false|this)\b/,
      builtin: /\b(console|document|window|Math|JSON|Object|Array|Promise|Set|Map|fetch)\b/
    },
    bash: {
      kw: /\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|local|source|echo|cd|ls|cat|grep|sed|awk|curl|npm|node|git)\b/,
      builtin: /\$\w+|\$\{[^}]*\}/
    }
  };
  GRAMMAR.js = GRAMMAR.javascript;
  GRAMMAR.py = GRAMMAR.python;
  GRAMMAR.sh = GRAMMAR.bash;
  GRAMMAR.shell = GRAMMAR.bash;

  function esc(s) {
    return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }

  function highlight(code, lang) {
    var g = GRAMMAR[(lang || '').toLowerCase()] || GRAMMAR.python;
    var out = '', i = 0;
    /* 先切出注释与字符串，剩下的再分词 */
    var re = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
    var m;
    while ((m = re.exec(code))) {
      out += words(code.slice(i, m.index), g);
      var tok = m[0];
      var cls = (tok[0] === '#' || tok.slice(0, 2) === '//' || tok.slice(0, 2) === '/*') ? 'c' : 's';
      out += '<span class="tk-' + cls + '">' + esc(tok) + '</span>';
      i = m.index + tok.length;
    }
    out += words(code.slice(i), g);
    return out;
  }

  function words(chunk, g) {
    if (!chunk) return '';
    var out = '';
    var re = /([A-Za-z_$][\w$]*|\d+\.?\d*)/g, last = 0, m;
    while ((m = re.exec(chunk))) {
      out += esc(chunk.slice(last, m.index));
      var w = m[0];
      if (/^\d/.test(w)) out += '<span class="tk-n">' + esc(w) + '</span>';
      else if (g.kw && g.kw.test(w)) out += '<span class="tk-k">' + esc(w) + '</span>';
      else if (g.builtin && g.builtin.test(w)) out += '<span class="tk-b">' + esc(w) + '</span>';
      else out += esc(w);
      last = m.index + w.length;
    }
    return out + esc(chunk.slice(last));
  }

  function langOf(fig) {
    var cap = fig.querySelector('figcaption span, figcaption');
    var t = cap ? cap.textContent.trim().split(/\s+/)[0] : '';
    return t.toLowerCase();
  }

  function initCode(root) {
    [].forEach.call(root.querySelectorAll('pre > code'), function (code) {
      if (code.dataset.lyraHl) return;
      code.dataset.lyraHl = '1';
      var fig = code.closest('figure') || code.parentElement.parentElement;
      var raw = code.textContent;
      if (code.children.length === 0) code.innerHTML = highlight(raw, langOf(fig));

      /* 复制按钮：找同一块里带「复制」的按钮，没有就补一个 */
      var btn = fig && fig.querySelector('button');
      if (btn && !btn.dataset.lyraCopy) {
        btn.dataset.lyraCopy = '1';
        var label = btn.querySelector('span:last-child') || btn;
        var original = btn.textContent;
        btn.addEventListener('click', function () {
          var done = function () {
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = original; }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(raw).then(done).catch(fallback);
          } else fallback();
          function fallback() {
            var ta = document.createElement('textarea');
            ta.value = raw; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            ta.remove();
          }
        });
      }
    });
  }

  /* ══ 2. 图片查看器 ══ */
  var box = null;
  function viewer(src, alt) {
    if (box) box.remove();
    box = document.createElement('div');
    box.className = 'lyra-lightbox';
    box.innerHTML =
      '<button type="button" class="lb-close" aria-label="关闭">✕</button>' +
      '<img src="' + src + '" alt="' + (alt || '').replace(/"/g, '&quot;') + '">' +
      (alt ? '<figcaption>' + alt.replace(/</g, '&lt;') + '</figcaption>' : '');
    document.body.appendChild(box);
    document.body.style.overflow = 'hidden';
    var shut = function () {
      if (box) box.remove();
      box = null;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    function onKey(e) { if (e.key === 'Escape') shut(); }
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.className === 'lb-close') shut();
    });
    document.addEventListener('keydown', onKey);
  }

  function initImages(root) {
    [].forEach.call(root.querySelectorAll('figure img, .article-img img, main img'), function (img) {
      if (img.dataset.lyraView) return;
      if (img.closest('.lyra-header, .lyra-footer, .lyra-lightbox')) return;
      if (img.naturalWidth && img.naturalWidth < 120) return;
      img.dataset.lyraView = '1';
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        var cap = img.closest('figure');
        cap = cap && cap.querySelector('figcaption');
        viewer(img.currentSrc || img.src, img.alt || (cap ? cap.textContent.trim() : ''));
      });
    });
  }

  /* ══ 3. 古文引用用专用字体 ══ */
  function initQuotes(root) {
    [].forEach.call(root.querySelectorAll('blockquote'), function (q) {
      if (q.dataset.lyraQuote) return;
      q.dataset.lyraQuote = '1';
      var txt = q.textContent || '';
      var cjk = (txt.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (cjk / Math.max(txt.replace(/\s/g, '').length, 1) > 0.6) {
        q.classList.add('lyra-quote-cjk');
      }
    });
  }

  function run(root) {
    root = root || document;
    try { initCode(root); } catch (e) {}
    try { initImages(root); } catch (e) {}
    try { initQuotes(root); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { run(); });
  } else run();

  /* React 卡片是异步渲染的，观察 DOM 变化补挂 */
  var pending = null;
  new MutationObserver(function () {
    clearTimeout(pending);
    pending = setTimeout(function () { run(); }, 60);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.LyraDSRuntime = { run: run, highlight: highlight, viewer: viewer };
})();
