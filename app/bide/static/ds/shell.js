/* ── Lyra Shell 运行时 ────────────────────────────────────────────
   目录从正文真实抓取。横线直接可点；悬停时本条与邻近撑开为标题。
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var header = document.querySelector('.lyra-header');
  /* 只有明确标了正文范围的页面才生成目录（首页、索引页不需要） */
  var scope = document.querySelector('[data-lyra-content]');

  var heads = !scope ? [] : [].slice.call(scope.querySelectorAll('h2, h3, h4')).filter(function (h) {
    return h.textContent.trim() &&
      !h.closest('.lyra-header, .lyra-footer, [data-lyra-no-toc]');
  });

  heads.forEach(function (h, i) {
    if (!h.id) {
      var slug = h.textContent.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 40);
      h.id = slug ? 'sec-' + slug : 'sec-' + i;
    }
  });

  function weightOf(i) {
    var a = heads[i], b = heads[i + 1], n = 0, el = a.nextElementSibling;
    while (el && el !== b) { n += (el.textContent || '').length; el = el.nextElementSibling; }
    return n;
  }
  var weights = heads.map(function (_, i) { return weightOf(i); });
  var maxW = Math.max.apply(null, weights.concat([1]));

  var rail = null, fab = null, scrim = null, panel = null, active = 0;

  if (heads.length >= 2) {
    /* ── 右侧横线轨道 ── */
    rail = document.createElement('nav');
    rail.className = 'lyra-toc-rail';
    rail.setAttribute('aria-label', '目录');

    heads.forEach(function (h, i) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';
      row.dataset.i = i;

      var lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = h.textContent.trim();

      var d = document.createElement('span');
      d.className = 'dash';
      var lvl = parseInt(h.tagName[1], 10);
      var base = lvl === 2 ? 18 : lvl === 3 ? 13 : 9;
      d.style.width = (base + (weights[i] / maxW) * 22).toFixed(1) + 'px';

      row.appendChild(lab);
      row.appendChild(d);

      row.addEventListener('mouseenter', function () { spread(i); });
      row.addEventListener('focus', function () { spread(i); });
      row.addEventListener('click', function () { go(i); });
      rail.appendChild(row);
    });
    rail.addEventListener('mouseleave', function () { spread(null); });
    document.body.appendChild(rail);

    /* ── 移动端按钮 ── */
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'lyra-toc-fab';
    fab.innerHTML = '<span aria-hidden="true">☰</span>目录';
    fab.addEventListener('click', function () { panel ? close() : openPanel(); });
    document.body.appendChild(fab);

    paint();
    spy();
    onScroll(function () { spy(); });
  }

  /* 悬停时把本条与邻近一两条撑开 */
  function spread(idx) {
    if (!rail) return;
    [].forEach.call(rail.children, function (row, i) {
      if (idx === null) { row.removeAttribute('data-near'); return; }
      var d = Math.abs(i - idx);
      if (d <= 2) row.dataset.near = String(d);
      else row.removeAttribute('data-near');
    });
  }

  function go(i) {
    var el = heads[i];
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - (headerH() + 16);
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + el.id);
  }

  function headerH() { return header ? header.getBoundingClientRect().height : 0; }

  /* ── 移动端面板 ── */
  function openPanel() {
    scrim = document.createElement('button');
    scrim.type = 'button';
    scrim.className = 'lyra-toc-scrim';
    scrim.setAttribute('aria-label', '关闭目录');

    panel = document.createElement('aside');
    panel.className = 'lyra-toc-panel';
    var head = document.createElement('div');
    head.className = 'lyra-toc-head';
    head.innerHTML = '<span>目录</span><button type="button" aria-label="关闭">✕</button>';
    panel.appendChild(head);
    panel.appendChild(document.createElement('hr'));

    var nav = document.createElement('nav');
    heads.forEach(function (h, i) {
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.dataset.lvl = h.tagName[1];
      a.innerHTML = '<span class="bullet"></span>';
      a.appendChild(document.createTextNode(h.textContent.trim()));
      a.addEventListener('click', function (e) { e.preventDefault(); close(); go(i); });
      nav.appendChild(a);
    });
    panel.appendChild(nav);

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    scrim.addEventListener('click', close);
    head.querySelector('button').addEventListener('click', close);
    document.addEventListener('keydown', onEsc);
    paint();
  }
  function close() {
    if (scrim) { scrim.remove(); scrim = null; }
    if (panel) { panel.remove(); panel = null; }
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }

  function paint() {
    if (rail) [].forEach.call(rail.children, function (row, i) {
      row.dataset.active = i === active ? '1' : '0';
    });
    if (panel) [].forEach.call(panel.querySelectorAll('nav a'), function (a, i) {
      a.dataset.active = i === active ? '1' : '0';
    });
  }

  function spy() {
    var line = headerH() + window.innerHeight * 0.22;
    var idx = 0;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) idx = i; else break;
    }
    if (idx !== active) { active = idx; paint(); }
  }

  /* ── 进度条 ── */
  function progress() {
    if (!header) return;
    var d = document.documentElement;
    var max = d.scrollHeight - d.clientHeight;
    header.style.setProperty('--lyra-progress', (max > 0 ? (d.scrollTop / max) * 100 : 0).toFixed(2) + '%');
  }

  function onScroll(fn) {
    var t = false;
    addEventListener('scroll', function () {
      if (!t) { t = true; requestAnimationFrame(function () { fn(); progress(); t = false; }); }
    }, { passive: true });
    addEventListener('resize', function () { fn(); progress(); }, { passive: true });
  }
  if (heads.length < 2) onScroll(function () {});
  progress();
})();

/* 回顶部 */
document.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.lyra-top');
  if (!t) return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* Shared account navigation from fujioky-auth. */
(function () {
  if (!document.querySelector('[data-lyra-auth]')) return;
  var script = document.createElement('script');
  script.src = '/auth/ui.js';
  document.head.appendChild(script);
})();

/* ── 文章 AI 问答 ────────────────────────────────────────────────
   只有服务端确认后端已配置且当前身份有权限时才渲染按钮。
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!document.querySelector('[data-lyra-content]')) return;   /* 只在文章页 */
  if (document.querySelector('[data-lyra-ai-demo]')) return;    /* 设计系统里自带演示 */

  fetch('/api/ai/status', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (s.enabled) mount();
      else if (s.configured) mountLoginPrompt();   /* 后端就绪但未登录 */
    })
    .catch(function () {});

  /* 未登录：入口仍在，点了去登录；划词送来的引用也引导登录 */
  function mountLoginPrompt() {
    window.addEventListener('lyra:ask', function () {
      location.href = '/auth/login?next=' + encodeURIComponent(location.pathname);
    });
    var go = function () {
      location.href = '/auth/login?next=' + encodeURIComponent(location.pathname);
    };
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'lyra-ai-fab';
    fab.setAttribute('aria-label', '登录后可就本文提问');
    fab.innerHTML = '<span class="sp" aria-hidden="true">✦</span><span class="txt">登录问 AI</span>';
    fab.addEventListener('click', go);
    document.body.appendChild(fab);
    window.__lyraAiOpen = go;
  }

  function mount() {
    var slug = (location.pathname.match(/\/posts\/([^/]+)/) || [])[1] || '';
    var history = [], busy = false, panel = null, scrim = null, log = null;

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'lyra-ai-fab';
    fab.setAttribute('aria-label', '就这篇文章提问');
    fab.innerHTML = '<span class="sp" aria-hidden="true">✦</span><span class="txt">问 AI</span>';
    fab.addEventListener('click', open);
    document.body.appendChild(fab);
    window.__lyraAiOpen = open;

    var staged = [];     /* 暂存的引用，可多条 */
    var shots = [];      /* 待发送的图片 dataURL */
    var CHAT_KEY = 'lyra:chat:' + slug;
    var chatRemote = false;

    function loadHistory() {
      return fetch('/api/chats?slug=' + encodeURIComponent(slug), { credentials: 'same-origin' })
        .then(function (r) { if (r.status === 401) throw new Error('anon'); return r.json(); })
        .then(function (d) {
          chatRemote = true;
          history = (d.messages || []).map(function (m) {
            return { role: m.role, text: m.text, shots: m.shots || 0 };
          });
        })
        .catch(function () {
          chatRemote = false;
          try { history = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); } catch (e) { history = []; }
        });
    }

    function saveHistory() {
      if (chatRemote) {
        fetch('/api/chats', {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slug, messages: history }),
        }).catch(function () {});
      } else {
        try {
          localStorage.setItem(CHAT_KEY, JSON.stringify(history.map(function (m) {
            return { role: m.role, text: m.text, shots: (m.images || []).length };
          })));
        } catch (e) {}
      }
    }

    function clearHistory() {
      history = [];
      if (chatRemote) {
        fetch('/api/chats?slug=' + encodeURIComponent(slug),
          { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
      } else {
        try { localStorage.removeItem(CHAT_KEY); } catch (e) {}
      }
      render();
      showEmpty();
    }

    loadHistory();

    var DOCK_KEY = 'lyra:ai:dock';
    var docked = localStorage.getItem(DOCK_KEY) === '1';
    /* 偏好只在面板真的打开时才生效，否则页面会空出一条无人认领的侧栏 */
    document.documentElement.dataset.lyraDock = '0';
    var w = localStorage.getItem('lyra:ai:dockw');
    if (w) document.documentElement.style.setProperty('--dock-w', w);
    window.addEventListener('lyra:ask', function (e) {
      var q = (e.detail && e.detail.quote) || '';
      var note = (e.detail && e.detail.note) || '';
      if (q) {
        var hit = staged.filter(function (x) { return x.text === q; })[0];
        if (hit) { if (note) hit.note = note; }
        else staged.push({ text: q, note: note });
      }
      if (staged.length > 8) staged = staged.slice(-8);
      if (!panel) open(); else renderQuote();
      /* 焦点落到这段自己的输入框，而不是底部通用框 */
      setTimeout(function () {
        if (!panel) return;
        var inputs = panel.querySelectorAll('.q-ask');
        var last = inputs[inputs.length - 1];
        if (last) last.focus();
        else { var ta = panel.querySelector('.lyra-ai-form textarea'); if (ta) ta.focus(); }
      }, 80);
    });

    function renderQuote() {
      if (!panel) return;
      var wrap = panel.querySelector('.lyra-ai-quotes');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'lyra-ai-quotes';
        panel.insertBefore(wrap, panel.querySelector('.lyra-ai-shots'));
      }
      wrap.innerHTML = '';
      if (!staged.length) return;
      if (staged.length > 1) {
        var hd = document.createElement('div');
        hd.className = 'q-head';
        hd.innerHTML = '<span>已选 ' + staged.length + ' 段 · 可分别提问</span>' +
          '<button type="button" data-a="clear">全部移除</button>';
        hd.querySelector('[data-a="clear"]').addEventListener('click', function () {
          staged = []; renderQuote();
        });
        wrap.appendChild(hd);
      }
      staged.forEach(function (q, i) {
        var box = document.createElement('div');
        box.className = 'lyra-ai-quote';

        var head = document.createElement('div');
        head.className = 'q-body';
        if (staged.length > 1) {
          var no = document.createElement('i');
          no.className = 'q-no';
          no.textContent = i + 1;
          head.appendChild(no);
        }
        var sp = document.createElement('span');
        sp.textContent = q.text;
        var x = document.createElement('button');
        x.type = 'button';
        x.setAttribute('aria-label', '移除这段引用');
        x.textContent = '✕';
        x.addEventListener('click', function () { staged.splice(i, 1); renderQuote(); });
        head.appendChild(sp); head.appendChild(x);

        var ask = document.createElement('input');
        ask.className = 'q-ask';
        ask.placeholder = '就这段问点什么…';
        ask.value = q.note || '';
        ask.addEventListener('input', function () { q.note = ask.value; });
        ask.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var ta = panel.querySelector('.lyra-ai-form textarea');
            send(ta);
          }
        });

        box.appendChild(head);
        box.appendChild(ask);
        wrap.appendChild(box);
      });
    }

    function open() {
      scrim = document.createElement('button');
      scrim.type = 'button'; scrim.className = 'lyra-ai-scrim';
      scrim.setAttribute('aria-label', '关闭');
      scrim.addEventListener('click', close);

      panel = document.createElement('section');
      panel.className = 'lyra-ai-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', '文章问答');
      panel.innerHTML =
        '<div class="lyra-ai-grip" title="拖动改变宽度"></div>' +
        '<div class="lyra-ai-head"><span class="sp" aria-hidden="true">✦</span>' +
        '<b>就这篇文章提问</b>' +
        '<button type="button" class="mode dock" aria-label="切换停靠"></button>' +
        '<button type="button" class="mode wipe" aria-label="清空这篇的对话" title="清空这篇的对话">⟲</button>' +
        '<button type="button" class="mode close" aria-label="关闭">✕</button></div>' +
        '<div class="lyra-ai-log"></div>' +
        '<div class="lyra-ai-shots"></div>' +
        '<form class="lyra-ai-form">' +
        '<span class="lyra-ai-tools">' +
          '<button type="button" class="tool up" aria-label="上传图片" title="上传图片">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
            '<circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 15l-5-5L6 20"/></svg>' +
          '</button>' +
          '<button type="button" class="tool shot" aria-label="截图" title="截取屏幕">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/>' +
            '<path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/>' +
            '<circle cx="12" cy="12" r="3"/></svg>' +
          '</button>' +
        '</span>' +
        '<textarea rows="1" placeholder="问点什么…"></textarea>' +
        '<button type="submit" class="send">发送</button></form>';

      document.body.appendChild(scrim);
      document.body.appendChild(panel);
      fab.style.display = 'none';

      panel.removeAttribute('data-drop');
      log = panel.querySelector('.lyra-ai-log');
      if (!history.length) showEmpty(); else render();
      panel.querySelector('.wipe').addEventListener('click', clearHistory);

      panel.querySelector('.lyra-ai-head .close').addEventListener('click', close);
      var form = panel.querySelector('form');
      var ta = form.querySelector('textarea');
      form.addEventListener('submit', function (e) { e.preventDefault(); send(ta); });
      ta.addEventListener('input', function () {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta); }
      });
      document.addEventListener('keydown', onEsc);
      document.addEventListener('mousedown', onOutside, true);
      renderQuote();
      applyDock();
      wireDock();
      wireShots(ta);
      setTimeout(function () { ta.focus(); }, 60);
    }

    /* ── 图片：选择 / 粘贴截图 / 拖拽 ── */
    var MAX_SHOTS = 4, MAX_BYTES = 4 * 1024 * 1024;

    function addFile(file) {
      if (!file || !/^image\//.test(file.type)) return;
      if (shots.length >= MAX_SHOTS) return;
      var r = new FileReader();
      r.onload = function () {
        shrink(r.result, function (url) {
          if (url.length * 0.75 > MAX_BYTES) return;
          shots.push(url);
          renderShots();
        });
      };
      r.readAsDataURL(file);
    }

    /* 截图往往很大，等比压到长边 1600 再传 */
    function shrink(dataUrl, cb) {
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height;
        if (w <= max && h <= max) return cb(dataUrl);
        var k = Math.min(max / w, max / h);
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { cb(dataUrl); };
      img.src = dataUrl;
    }

    function renderShots() {
      if (!panel) return;
      var box = panel.querySelector('.lyra-ai-shots');
      box.innerHTML = '';
      shots.forEach(function (url, i) {
        var d = document.createElement('div');
        d.className = 'lyra-ai-shot';
        var im = document.createElement('img');
        im.src = url;
        var x = document.createElement('button');
        x.type = 'button'; x.textContent = '✕';
        x.setAttribute('aria-label', '移除');
        x.addEventListener('click', function () { shots.splice(i, 1); renderShots(); });
        d.appendChild(im); d.appendChild(x);
        box.appendChild(d);
      });
    }

    /* 快捷截图：调用浏览器的屏幕捕获，抓一帧即停 */
    function capture() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) return;
      navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true
      }).then(function (stream) {
        var v = document.createElement('video');
        v.srcObject = stream;
        v.muted = true;
        v.play();
        var done = false;
        function grab() {
          if (done) return;
          if (!v.videoWidth) return requestAnimationFrame(grab);
          done = true;
          var c = document.createElement('canvas');
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0);
          stream.getTracks().forEach(function (t) { t.stop(); });
          var url = c.toDataURL('image/png');
          shrink(url, function (u) {
            if (shots.length < MAX_SHOTS) { shots.push(u); renderShots(); }
          });
        }
        v.addEventListener('loadedmetadata', grab);
        setTimeout(grab, 300);
      }).catch(function () { /* 用户取消，静默 */ });
    }

    function wireShots(ta) {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
      input.style.display = 'none';
      panel.appendChild(input);
      input.addEventListener('change', function () {
        [].forEach.call(input.files, addFile);
        input.value = '';
      });
      panel.querySelector('.tool.up').addEventListener('click', function () { input.click(); });

      var shotBtn = panel.querySelector('.tool.shot');
      if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
        shotBtn.disabled = true;
        shotBtn.title = '这个浏览器不支持屏幕截取，可用系统截图后粘贴';
      }
      shotBtn.addEventListener('click', capture);

      /* 截图后 Ctrl/Cmd+V 直接贴进来 */
      ta.addEventListener('paste', function (e) {
        var items = (e.clipboardData || {}).items || [];
        var got = false;
        [].forEach.call(items, function (it) {
          if (it.kind === 'file' && /^image\//.test(it.type)) {
            addFile(it.getAsFile());
            got = true;
          }
        });
        if (got) e.preventDefault();
      });

      /* 拖进面板：只认文件拖拽，任何结束信号都清掉遮罩 */
      var depth = 0;
      function isFiles(e) {
        return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
      }
      function clearDrop() { depth = 0; if (panel) panel.removeAttribute('data-drop'); }

      panel.addEventListener('dragenter', function (e) {
        if (!isFiles(e)) return;
        e.preventDefault(); depth++; panel.dataset.drop = '1';
      });
      panel.addEventListener('dragover', function (e) {
        if (!isFiles(e)) return;
        e.preventDefault();
      });
      panel.addEventListener('dragleave', function (e) {
        if (!isFiles(e)) return;
        if (--depth <= 0) clearDrop();
      });
      panel.addEventListener('drop', function (e) {
        e.preventDefault(); clearDrop();
        if (e.dataTransfer && e.dataTransfer.files) [].forEach.call(e.dataTransfer.files, addFile);
      });
      /* 兜底：拖拽在面板外结束时也清掉 */
      ['dragend', 'drop', 'mouseleave', 'blur'].forEach(function (ev) {
        window.addEventListener(ev, clearDrop);
      });
    }

    /* ── 停靠 / 悬浮 ── */
    function applyDock() {
      if (!panel) { document.documentElement.dataset.lyraDock = '0'; return; }
      panel.dataset.dock = docked ? '1' : '0';
      if (scrim) scrim.dataset.dock = docked ? '1' : '0';
      document.documentElement.dataset.lyraDock = docked ? '1' : '0';
      var m = panel.querySelector('.mode.dock');
      if (m) {
        m.textContent = docked ? '⇱' : '⇲';
        m.title = docked ? '改为悬浮' : '固定到右侧边栏';
      }
    }

    function wireDock() {
      panel.querySelector('.mode.dock').addEventListener('click', function () {
        docked = !docked;
        localStorage.setItem(DOCK_KEY, docked ? '1' : '0');
        applyDock();
      });

      /* 拖左边缘改宽度 */
      var grip = panel.querySelector('.lyra-ai-grip');
      var startX = 0, startW = 0;
      grip.addEventListener('mousedown', function (e) {
        if (!docked) return;
        e.preventDefault();
        grip.dataset.drag = '1';
        startX = e.clientX;
        startW = panel.getBoundingClientRect().width;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      function move(e) {
        var w = Math.min(Math.max(startW + (startX - e.clientX), 300), Math.min(720, innerWidth * 0.6));
        document.documentElement.style.setProperty('--dock-w', w + 'px');
      }
      function up() {
        grip.removeAttribute('data-drag');
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        localStorage.setItem('lyra:ai:dockw',
          getComputedStyle(document.documentElement).getPropertyValue('--dock-w').trim());
      }
    }

    function showEmpty() {
      if (!log) return;
      var title = (document.querySelector('h1') || {}).textContent || '本文';
      log.innerHTML = '<div class="lyra-ai-empty"><b>' + escapeHtml(title.trim()) + '</b>' +
        '回答基于这篇文章的正文。超出文章范围的问题会注明。' +
        (chatRemote ? '对话会跟着你的账号保存。' : '未登录，对话只存在这台设备上。') + '</div>';
    }

    function close() {
      if (scrim) { scrim.remove(); scrim = null; }
      if (panel) { panel.remove(); panel = null; }
      document.documentElement.dataset.lyraDock = '0';
      fab.style.display = '';
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('mousedown', onOutside, true);
    }

    /* 悬浮态点面板外关闭；停靠态常驻不关。
       只监听不拦截，正文照常可选词继续追加引用。 */
    function onOutside(e) {
      if (docked || !panel) return;
      var t = e.target;
      if (!t.closest) return;
      if (t.closest('.lyra-ai-panel, .lyra-ai-fab, .lyra-sel-bar, .lyra-note-pop, .lyra-notes-panel')) return;
      if (window.getSelection && !window.getSelection().isCollapsed) return;  /* 正在选词，别关 */
      close();
    }
    function onEsc(e) { if (e.key === 'Escape') close(); }

    function escapeHtml(s) {
      return String(s).replace(/[&<>]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
      });
    }
    function fmt(t) {
      return escapeHtml(t).replace(/`([^`\n]+)`/g, '<code>$1</code>');
    }

    function render(streaming) {
      if (!log) return;
      log.innerHTML = history.map(function (m) {
        return '<div class="lyra-ai-msg ' + (m.role === 'user' ? 'me' : '') + '">' +
          '<div class="who">' + (m.role === 'user' ? 'You' : 'AI') + '</div>' +
          '<div class="bubble">' + (m.text ? fmt(m.text) :
            '<span class="lyra-ai-dots"><span></span><span></span><span></span></span>') +
          (m.images || []).map(function (u) { return '<img class="shot" src="' + u + '" alt="">'; }).join('') +
          (!m.images && m.shots ? '<div style="opacity:.6;font-size:11px;margin-top:6px">（' + m.shots + ' 张图片）</div>' : '') +
          '</div></div>';
      }).join('');
      if (streaming !== false) log.scrollTop = log.scrollHeight;
    }

    function send(ta) {
      var text = (ta.value || '').trim();
      var anyAsk = staged.some(function (q) { return (q.note || '').trim(); });
      if (!text && !anyAsk && staged.length) text = staged.length > 1 ? '这几段怎么理解？' : '这段是什么意思？';
      if (!text && shots.length) text = '看看这张图。';
      if (!text || busy) return;
      var imgs = shots.slice();
      if (staged.length) {
        /* 每段引用与它自己的问题配对，不再混成一坨 */
        var blocks = staged.map(function (q, i) {
          var tag = staged.length > 1 ? ('（' + (i + 1) + '）') : '';
          var ask = (q.note || '').trim();
          return tag + '原文：「' + q.text + '」\n' +
                 tag.replace(/./g, ' ') + '我的问题：' + (ask || '这段是什么意思？');
        }).join('\n\n');
        text = blocks + (text ? ('\n\n补充：' + text) : '');
        staged = [];
        renderQuote();
      }
      busy = true;
      ta.value = ''; ta.style.height = 'auto';
      var sendBtn = panel.querySelector('.lyra-ai-form button[type="submit"]');
      if (sendBtn) sendBtn.disabled = true;

      var prior = history.slice();
      shots = []; renderShots();
      history.push({ role: 'user', text: text, images: imgs });
      history.push({ role: 'ai', text: '' });
      render();

      fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, slug: slug, history: prior, images: imgs }),
      }).then(function (r) {
        if (!r.ok || !r.body) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            throw new Error(j.error || ('请求失败 ' + r.status));
          });
        }
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', acc = '';
        return (function pump() {
          return reader.read().then(function (res) {
            if (res.done) return;
            buf += dec.decode(res.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(function (line) {
              if (!line.indexOf('data: ')) {
                var d = line.slice(6);
                if (d === '[DONE]') return;
                try {
                  var j = JSON.parse(d);
                  if (j.delta) { acc += j.delta; history[history.length - 1].text = acc; render(); }
                } catch (e) {}
              }
            });
            return pump();
          });
        })();
      }).catch(function (err) {
        history[history.length - 1].text = '（' + (err.message || '出错了') + '）';
        render();
      }).then(function () {
        busy = false;
        saveHistory();
        if (panel) {
          var b = panel.querySelector('.lyra-ai-form button[type="submit"]');
          if (b) b.disabled = false;
        }
      });
    }
  }
})();

/* ── 划词：批注 / 问 AI ────────────────────────────────────────
   选中正文后浮出一个入口，气泡里选去向：
   「问 AI」把引用送进对话输入框（不自动发送）；
   「给自己」存成批注，正文留高亮。
   登录后存服务端跟着账号走，未登录退回本机 localStorage。
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var scope = document.querySelector('[data-lyra-content]');
  if (!scope) return;

  var SLUG = (location.pathname.match(/\/posts\/([^/]+)/) || [])[1] || location.pathname;
  var KEY = 'lyra:notes:' + SLUG;
  var bar = null, pop = null;
  var notes = [];
  var remote = false;          /* 是否已登录、用服务端存 */

  function boot() {
    fetch('/api/notes?slug=' + encodeURIComponent(SLUG), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) throw new Error('anon');
        return r.json();
      })
      .then(function (d) { remote = true; notes = d.notes || []; paint(); })
      .catch(function () {
        remote = false;
        try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { notes = []; }
        paint();
      });
  }

  function persist() {
    if (remote) {
      fetch('/api/notes', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, notes: notes }),
      }).catch(function () {});
    } else {
      try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {}
    }
  }

  function killBar() { if (bar) { bar.remove(); bar = null; } }
  function killPop() { if (pop) { pop.remove(); pop = null; } }

  document.addEventListener('mouseup', onSelect);
  document.addEventListener('touchend', function () { setTimeout(onSelect, 10); });

  function onSelect(e) {
    if (e && e.target && e.target.closest &&
        e.target.closest('.lyra-sel-bar, .lyra-note-pop, .lyra-ai-panel, .lyra-header, .lyra-footer')) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) { killBar(); return; }
    var text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) { killBar(); return; }
    var range = sel.getRangeAt(0);
    if (!scope.contains(range.commonAncestorContainer)) { killBar(); return; }

    killBar();
    var r = range.getBoundingClientRect();
    bar = document.createElement('div');
    bar.className = 'lyra-sel-bar';
    bar.innerHTML = '<button type="button"><span class="g">✎</span>批注</button>';
    document.body.appendChild(bar);
    place(bar, r);
    var btn = bar.querySelector('button');
    /* mousedown 只阻止默认行为（保住选区），真正动作放在 click */
    btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    btn.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      openPop(text, r);
    });
  }

  function place(el, r) {
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = window.scrollX + r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.scrollX + window.innerWidth - w - 8));
    var top = window.scrollY + r.top - h - 10;
    if (r.top - h - 10 < 70) top = window.scrollY + r.bottom + 10;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  /* ── 批注气泡 ── */
  function openPop(text, rect, existing) {
    killBar(); killPop();
    var mode = existing ? 'me' : 'ai';
    pop = document.createElement('div');
    pop.className = 'lyra-note-pop';
    pop.innerHTML =
      '<div class="tabs">' +
        '<button type="button" data-m="ai"><span class="g">✦</span>问 AI</button>' +
        '<button type="button" data-m="me"><span class="g">✎</span>给自己</button>' +
      '</div>' +
      '<div class="quote"></div>' +
      '<textarea></textarea>' +
      '<div class="row">' +
        '<button type="button" class="ghost" data-a="cancel">' + (existing ? '删除' : '取消') + '</button>' +
        '<button type="button" data-a="ok">批注</button>' +
      '</div>';
    document.body.appendChild(pop);
    pop.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
    pop.querySelector('.quote').textContent = text;
    var ta = pop.querySelector('textarea');
    var ok = pop.querySelector('[data-a="ok"]');
    if (existing) ta.value = existing.note || '';

    function setMode(m) {
      mode = m;
      [].forEach.call(pop.querySelectorAll('.tabs button'), function (b) {
        b.setAttribute('aria-pressed', b.dataset.m === m);
      });
      ta.placeholder = m === 'ai' ? '想问 AI 什么？（可留空）' : '写给自己的批注…';
      ok.textContent = m === 'ai' ? '送到对话' : '批注';
    }
    [].forEach.call(pop.querySelectorAll('.tabs button'), function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.m); ta.focus(); });
    });
    setMode(existing ? 'me' : 'ai');

    place(pop, rect);
    pop.style.top = (parseFloat(pop.style.top) + (rect.top < 200 ? 0 : 0)) + 'px';
    ta.focus();

    ok.addEventListener('click', function () {
      var v = ta.value.trim();
      if (mode === 'ai') {
        window.dispatchEvent(new CustomEvent('lyra:ask', { detail: { quote: text, note: v } }));
      } else if (existing) {
        existing.note = v;
        existing.at = Date.now();
        if (!v) notes = notes.filter(function (n) { return n.id !== existing.id; });
        persist(); paint();
      } else {
        var id = String(Date.now());
        notes.push({ id: id, text: text, note: v, at: Date.now() });
        persist(); paint();
        var m = scope.querySelector('mark.lyra-note[data-id="' + id + '"]');
        if (m) {
          m.style.transition = 'background 600ms';
          var was = m.style.background;
          m.style.background = 'var(--accent)';
          setTimeout(function () { m.style.background = was; }, 500);
        }
      }
      killPop();
      window.getSelection().removeAllRanges();
    });

    pop.querySelector('[data-a="cancel"]').addEventListener('click', function () {
      if (existing) {
        notes = notes.filter(function (n) { return n.id !== existing.id; });
        persist(); paint();
      }
      killPop();
      window.getSelection().removeAllRanges();
    });

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ok.click(); }
      if (e.key === 'Escape') { killPop(); }
    });
  }

  document.addEventListener('mousedown', function (e) {
    var t = e.target;
    var inBar = t.closest && t.closest('.lyra-sel-bar');
    var inPop = t.closest && t.closest('.lyra-note-pop');
    var onMark = t.closest && t.closest('mark.lyra-note');
    if (bar && !inBar) killBar();
    /* 工具条按钮就是弹窗的来源，同一次 mousedown 冒泡上来不能把它关掉 */
    if (pop && !inPop && !onMark && !inBar) killPop();
  });

  /* ── 把批注画回正文 ──
     建一份全文索引（空白归一化，同时保留到原节点的映射），
     用它定位，可跨多个文本节点包裹。 */
  function buildIndex() {
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (!p || p.closest('script, style, .lyra-header, .lyra-footer, [data-lyra-no-toc]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var flat = '', map = [], node;
    while ((node = walker.nextNode())) {
      var v = node.nodeValue;
      for (var k = 0; k < v.length; k++) {
        var ch = v[k];
        if (/\s/.test(ch)) {
          if (flat.length && flat[flat.length - 1] === ' ') continue;   /* 连续空白压成一个 */
          ch = ' ';
        }
        flat += ch;
        map.push({ node: node, offset: k });
      }
    }
    return { flat: flat, map: map };
  }

  function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  /* 把 [from,to) 这段索引区间包成若干 mark，跨节点也行 */
  function wrap(idx, from, to, n) {
    if (from < 0 || to > idx.map.length || to <= from) return false;
    /* 按所属文本节点切段 */
    var segs = [], cur = null;
    for (var i = from; i < to; i++) {
      var p = idx.map[i];
      if (cur && cur.node === p.node && p.offset === cur.end) { cur.end = p.offset + 1; continue; }
      cur = { node: p.node, start: p.offset, end: p.offset + 1 };
      segs.push(cur);
    }
    var made = [];
    /* 从后往前包，避免前面的切分打乱后面的偏移 */
    for (var s = segs.length - 1; s >= 0; s--) {
      var g = segs[s];
      try {
        var r = document.createRange();
        r.setStart(g.node, g.start);
        r.setEnd(g.node, g.end);
        var m = document.createElement('mark');
        m.className = 'lyra-note';
        m.title = n.note || '（无批注内容）';
        m.dataset.id = n.id;
        r.surroundContents(m);
        made.push(m);
      } catch (e) {}
    }
    made.forEach(function (m) {
      m.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var cur2 = notes.filter(function (x) { return x.id === m.dataset.id; })[0];
        if (cur2) openPop(cur2.text, m.getBoundingClientRect(), cur2);
      });
    });
    return made.length > 0;
  }

  function paint() {
    /* 先拆掉旧的 mark 并合并回文本节点 */
    [].forEach.call(scope.querySelectorAll('mark.lyra-note'), function (m) {
      var p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
    scope.normalize();

    /* 每包一条就重建索引，因为 DOM 变了 */
    var used = [];
    notes.forEach(function (n) {
      var idx = buildIndex();
      var probe = norm(n.text);
      if (probe.length < 2) return;
      /* 跳过已被别的批注占用的位置 */
      var from = -1, search = 0;
      while (true) {
        from = idx.flat.indexOf(probe, search);
        if (from < 0) break;
        var key = from + ':' + probe.length;
        if (used.indexOf(key) < 0) { used.push(key); break; }
        search = from + 1;
      }
      if (from < 0) return;
      wrap(idx, from, from + probe.length, n);
    });
  }

  window.LyraNotes = {
    all: function () { return notes.slice(); },
    remote: function () { return remote; },
    remove: function (id) {
      notes = notes.filter(function (n) { return n.id !== id; });
      persist(); paint();
      window.dispatchEvent(new CustomEvent('lyra:notes-changed'));
    },
    open: function (id) {
      var m = scope.querySelector('mark.lyra-note[data-id="' + id + '"]');
      if (!m) return false;
      m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      m.classList.remove('flash');
      void m.offsetWidth;
      m.classList.add('flash');
      setTimeout(function () { m.classList.remove('flash'); }, 1300);
      return true;
    },
    quote: function (id) {
      var n = notes.filter(function (x) { return x.id === id; })[0];
      if (n) window.dispatchEvent(new CustomEvent('lyra:ask', { detail: { quote: n.text } }));
    }
  };

  var _persist = persist;
  persist = function () {
    _persist();
    window.dispatchEvent(new CustomEvent('lyra:notes-changed'));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ── 手机端底部操作簇：把目录与问 AI 并到一起 ── */
(function () {
  'use strict';
  if (!document.querySelector('[data-lyra-content]')) return;
  if (document.querySelector('[data-lyra-ai-demo]')) return;

  function build() {
    if (document.querySelector('.lyra-dock-cluster')) return;
    var hasToc = !!document.querySelector('.lyra-toc-rail, .lyra-toc-fab');
    var hasAi = typeof window.__lyraAiOpen === 'function';
    if (!hasToc && !hasAi) return;

    var box = document.createElement('div');
    box.className = 'lyra-dock-cluster';

    if (hasToc) {
      var t = document.createElement('button');
      t.type = 'button';
      t.innerHTML = '<span aria-hidden="true">☰</span>目录';
      t.addEventListener('click', function () {
        var f = document.querySelector('.lyra-toc-fab');
        if (f) f.click();
      });
      box.appendChild(t);
    }
    if (window.LyraNotes && window.LyraNotes.all().length) {
      var nb = document.createElement('button');
      nb.type = 'button';
      nb.innerHTML = '<span aria-hidden="true">✎</span>批注';
      nb.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('lyra:open-notes'));
      });
      box.appendChild(nb);
    }
    if (hasAi) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'ai';
      var label = document.querySelector('.lyra-ai-fab .txt');
      a.innerHTML = '<span class="sp" aria-hidden="true">✦</span>' +
        (label ? label.textContent : '问 AI');
      a.addEventListener('click', function () { window.__lyraAiOpen(); });
      box.appendChild(a);
    }
    document.body.appendChild(box);
  }

  /* AI 状态是异步来的，等它落地再拼 */
  var tries = 0;
  var t = setInterval(function () {
    build();
    if (++tries > 25 || document.querySelector('.lyra-dock-cluster')) clearInterval(t);
  }, 300);
  setTimeout(build, 400);
})();

/* 兜底：面板不存在时绝不保留停靠态，避免页面空出一条侧栏且无从关闭 */
(function () {
  function sweep() {
    if (!document.querySelector('.lyra-ai-panel')) {
      document.documentElement.dataset.lyraDock = '0';
    }
  }
  sweep();
  addEventListener('pageshow', sweep);
  setInterval(sweep, 1500);
})();

/* ── 批注侧栏：看自己在这篇文章里的全部批注 ── */
(function () {
  'use strict';
  if (!document.querySelector('[data-lyra-content]')) return;
  if (document.querySelector('[data-lyra-ai-demo]')) return;

  var fab = null, panel = null;

  function notes() {
    return (window.LyraNotes && window.LyraNotes.all()) || [];
  }

  function ensureFab() {
    var n = notes().length;
    if (!n) { if (fab) { fab.remove(); fab = null; } return; }
    if (!fab) {
      fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'lyra-notes-fab';
      fab.addEventListener('click', toggle);
      document.body.appendChild(fab);
    }
    fab.innerHTML = '<span aria-hidden="true">✎</span>批注<b>' + n + '</b>';
  }

  function esc(t) {
    return String(t).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  function render() {
    if (!panel) return;
    var list = panel.querySelector('.lyra-notes-list');
    var arr = notes();
    if (!arr.length) {
      list.innerHTML = '<div class="lyra-notes-empty">这篇还没有批注。<br>选中正文里的句子，点「批注」。</div>';
      return;
    }
    list.innerHTML = '';
    arr.forEach(function (n) {
      var c = document.createElement('div');
      c.className = 'lyra-note-card';
      var when = new Date(n.at || Date.now());
      c.innerHTML =
        '<div class="q">' + esc(n.text) + '</div>' +
        '<div class="n' + (n.note ? '' : ' empty') + '">' + esc(n.note || '（只标记，没写内容）') + '</div>' +
        '<div class="meta"><span>' +
          (when.getMonth() + 1) + '/' + when.getDate() + ' ' +
          String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0') +
        '</span><span>' +
          '<button type="button" data-a="ask">问 AI</button>　' +
          '<button type="button" data-a="del">删除</button>' +
        '</span></div>';
      c.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        window.LyraNotes.open(n.id);
      });
      c.querySelector('[data-a="ask"]').addEventListener('click', function (e) {
        e.stopPropagation();
        window.LyraNotes.quote(n.id);
      });
      c.querySelector('[data-a="del"]').addEventListener('click', function (e) {
        e.stopPropagation();
        window.LyraNotes.remove(n.id);
      });
      list.appendChild(c);
    });
  }

  function open() {
    panel = document.createElement('aside');
    panel.className = 'lyra-notes-panel';
    panel.setAttribute('role', 'complementary');
    panel.innerHTML =
      '<div class="lyra-notes-head"><span class="g" aria-hidden="true">✎</span>' +
      '<b>我的批注</b><button type="button" aria-label="关闭">✕</button></div>' +
      '<div class="lyra-notes-list"></div>';
    document.body.appendChild(panel);
    document.documentElement.dataset.lyraNotes = '1';
    panel.querySelector('.lyra-notes-head button').addEventListener('click', close);
    document.addEventListener('keydown', onEsc);
    render();
  }

  function close() {
    if (panel) { panel.remove(); panel = null; }
    document.documentElement.dataset.lyraNotes = '0';
    document.removeEventListener('keydown', onEsc);
    ensureFab();
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  function toggle() { panel ? close() : open(); }

  window.addEventListener('lyra:notes-changed', function () {
    ensureFab();
    render();
  });
  window.addEventListener('lyra:open-notes', function () { if (!panel) open(); });

  /* 批注是异步载入的，等它到位 */
  var tries = 0;
  var t = setInterval(function () {
    if (window.LyraNotes) { ensureFab(); if (++tries > 3) clearInterval(t); }
    else if (++tries > 30) clearInterval(t);
  }, 400);

  /* 兜底：面板不在就别留侧栏留白 */
  setInterval(function () {
    if (!document.querySelector('.lyra-notes-panel')) {
      document.documentElement.dataset.lyraNotes = '0';
    }
  }, 1500);
})();
/* ── 统一右侧栏 ────────────────────────────────────────────────
   批注 / 问 AI / 看板 三块本来是各自独立的面板：问 AI 有自己的停靠开关
   （<html data-lyra-dock>），批注是另一套侧栏（<html data-lyra-notes>），
   两者互不知情，可以同时打开、同时让位，这就是切换会乱的原因。

   这里加一条统一的标签栏：三个标签互斥切换，共用一套停靠/悬浮状态和让位宽度。
   各面板内部的实现不动——问 AI 那块两万多字符的对话逻辑照旧跑，
   只是由这里决定谁露面、以及正文让不让位。
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!document.querySelector('[data-lyra-content]')) return;
  if (document.querySelector('[data-lyra-ai-demo]')) return;

  var DOCK_KEY = 'lyra:side:dock';
  var docked = localStorage.getItem(DOCK_KEY) !== '0';   // 默认固定在右侧
  var active = null;                                     // 'notes' | 'ai' | 'board'
  var rail = null;
  var TABS = [
    { k: 'notes', t: '批注', i: '✎' },
    { k: 'ai', t: '问 AI', i: '✦' },
    { k: 'board', t: '看板', i: '▤' }
  ];

  function css() {
    if (document.getElementById('lyra-side-css')) return;
    var st = document.createElement('style');
    st.id = 'lyra-side-css';
    st.textContent = [
      /* 两态：没打开面板时是右下角的小药丸，打开后变成侧栏顶部的标题栏 */
      '.lyra-side{position:fixed;z-index:60;display:flex;align-items:center;gap:6px;box-sizing:border-box;',
      '  background:var(--surface-page,#fff);border:1px solid var(--border-hairline,#e2e8f0)}',
      '.lyra-side[data-on="0"]{right:18px;bottom:18px;padding:5px;border-radius:999px;',
      '  box-shadow:0 6px 20px rgba(16,24,40,.14)}',
      '.lyra-side[data-on="0"] .sp{display:none}',
      '.lyra-side[data-on="1"]{top:0;right:0;padding:10px 12px;border-radius:0;',
      '  border-top:0;border-right:0}',
      /* 这条栏取代了原来两个各自为政的悬浮按钮 */
      '.lyra-notes-fab,.lyra-ai-fab{display:none!important}',
      '.lyra-side .tabs{display:inline-flex;gap:2px;background:var(--surface-raised,#f7fafc);border-radius:8px;padding:3px}',
      '.lyra-side .tabs button{border:0;background:transparent;color:var(--text-muted,#718096);font-size:13px;',
      '  font-family:inherit;padding:5px 12px;border-radius:6px;cursor:pointer;line-height:1}',
      '.lyra-side .tabs button.on{background:var(--surface-page,#fff);color:var(--text-heading,#1a202c);font-weight:600;',
      '  box-shadow:0 1px 2px rgba(16,24,40,.10)}',
      '.lyra-side .sp{margin-left:auto;display:flex;gap:4px}',
      '.lyra-side .ic{border:0;background:transparent;font-size:15px;line-height:1;cursor:pointer;',
      '  color:var(--text-muted,#718096);padding:3px 6px}',
      '.lyra-side .ic:hover{color:var(--text-heading,#1a202c)}',
      /* 让三块面板都退到标签栏下面，别顶到屏幕最上沿 */
      'html[data-lyra-side="1"] .lyra-ai-panel[data-dock="1"],',
      'html[data-lyra-side="1"] .lyra-notes-panel{top:52px}',
      '.lyra-side-board{position:fixed;right:0;top:52px;bottom:0;z-index:55;overflow:auto;',
      '  background:var(--surface-page,#fff);border-left:1px solid var(--border-hairline,#e2e8f0)}',
      '.lyra-side-board .hint{padding:18px;color:var(--text-muted,#718096);font-size:13.5px;line-height:1.9}',
      '.lyra-side-board .hint a{color:var(--link,#3182ce)}',
      /* 让位用自己的标志：问 AI 模块有个定时器会把 data-lyra-dock 归零，不跟它抢 */
      'html[data-lyra-sdock="1"] body{padding-right:var(--dock-w)}',
      'html[data-lyra-sdock="1"] .lyra-header{right:var(--dock-w)}',
      'html[data-lyra-sdock="1"] .lyra-toc-rail{right:calc(var(--dock-w) + var(--rail-left-offset))}',
      'html[data-lyra-sdock="1"] .lyra-toc-fab{right:calc(var(--dock-w) + var(--gutter-mobile))}',
      '@media (max-width:900px){html[data-lyra-sdock="1"] body{padding-right:0}',
      '  html[data-lyra-sdock="1"] .lyra-header{right:0}}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── 各面板的开关：只调它们已有的入口，不碰内部实现 ── */
  var P = {
    notes: {
      el: function () { return document.querySelector('.lyra-notes-panel'); },
      open: function () { window.dispatchEvent(new CustomEvent('lyra:open-notes')); },
      close: function () {
        var e = document.querySelector('.lyra-notes-panel .lyra-notes-head button');
        if (e) e.click();
      }
    },
    ai: {
      el: function () { return document.querySelector('.lyra-ai-panel'); },
      open: function () { if (typeof window.__lyraAiOpen === 'function') window.__lyraAiOpen(); },
      close: function () {
        var e = document.querySelector('.lyra-ai-panel .lyra-ai-head [aria-label="关闭"], .lyra-ai-panel .lyra-ai-head button.close');
        if (e) { e.click(); return; }
        var p = document.querySelector('.lyra-ai-panel');
        if (p) p.remove();
        var s = document.querySelector('.lyra-ai-scrim');
        if (s) s.remove();
      }
    },
    board: {
      el: function () { return document.querySelector('.lyra-side-board'); },
      open: function () { board(true); },
      close: function () { board(false); }
    }
  };

  /* ── 看板标签：当前文章里正在看的那只标的 ── */
  var lastSym = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.tk');
    if (a) lastSym = (a.dataset.sym || a.textContent || '').trim().toUpperCase();
  }, true);

  function board(on) {
    var b = document.querySelector('.lyra-side-board');
    if (!on) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('aside');
      b.className = 'lyra-side-board';
      b.innerHTML = '<div class="hint">这里放当前正在看的标的。<br>' +
        '点正文里带虚线的代码就会在这里打开；<br>要看全部关注，去 <a href="/dashboard">股市看板</a>。</div>';
      document.body.appendChild(b);
    }
    sizeBoard();
    var sym = lastSym;
    if (sym && window.LyraTicker && window.LyraTicker.open) {
      // 复用行情组件，直接开在侧边栏形态
      window.LyraTicker.open(sym, false, 'dock');
    }
  }
  function sizeBoard() {
    var b = document.querySelector('.lyra-side-board');
    if (b) b.style.width = width() + 'px';
  }
  function width() {
    var w = parseInt(localStorage.getItem('lyra:ai:dockw') || '0', 10);
    return (w && w > 260) ? w : Math.min(460, Math.round(innerWidth * 0.42));
  }

  /* ── 状态同步 ── */
  function apply() {
    var on = !!active;
    rail.dataset.on = on ? '1' : '0';
    rail.style.width = (on && docked) ? width() + 'px' : 'auto';
    document.documentElement.dataset.lyraSide = on ? '1' : '0';
    // 让位只认这一个开关：停靠且有面板打开时才让
    var want = (on && docked) ? '1' : '0';
    document.documentElement.dataset.lyraSdock = want;
    document.documentElement.style.setProperty('--dock-w', width() + 'px');
    // 问 AI 面板自己也认 data-lyra-dock，它开着的时候让它继续用
    if (active !== 'ai') document.documentElement.dataset.lyraNotes = '0';
    TABS.forEach(function (t) {
      var btn = rail.querySelector('button[data-k="' + t.k + '"]');
      if (btn) btn.className = (active === t.k) ? 'on' : '';
    });
    var m = rail.querySelector('.ic.mode');
    if (m) { m.textContent = docked ? '⇱' : '⇲'; m.title = docked ? '改为悬浮' : '固定到右侧栏'; }
    sizeBoard();
  }

  function show(k) {
    if (active === k) { hide(); return; }
    TABS.forEach(function (t) { if (t.k !== k) try { P[t.k].close(); } catch (e) {} });
    active = k;
    try { P[k].open(); } catch (e) {}
    apply();
  }
  function hide() {
    TABS.forEach(function (t) { try { P[t.k].close(); } catch (e) {} });
    active = null;
    apply();
  }

  function build() {
    css();
    if (document.querySelector('.lyra-side')) return;
    rail = document.createElement('div');
    rail.className = 'lyra-side';
    rail.innerHTML = '<div class="tabs"></div><span class="sp">' +
      '<button type="button" class="ic mode" title="固定到右侧栏">⇱</button>' +
      '<button type="button" class="ic close" title="收起" aria-label="收起">✕</button></span>';
    var tabs = rail.querySelector('.tabs');
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.k = t.k;
      b.textContent = t.t;
      b.addEventListener('click', function () { show(t.k); });
      tabs.appendChild(b);
    });
    rail.querySelector('.ic.mode').addEventListener('click', function () {
      docked = !docked;
      localStorage.setItem(DOCK_KEY, docked ? '1' : '0');
      // 问 AI 面板有自己的停靠开关，跟着一起切
      var m = document.querySelector('.lyra-ai-panel .mode.dock');
      if (m) m.click();
      apply();
    });
    rail.querySelector('.ic.close').addEventListener('click', hide);
    document.body.appendChild(rail);
    apply();
  }

  /* 面板被它自己的关闭按钮/Esc 关掉时，标签栏也要跟着回到未选中 */
  setInterval(function () {
    if (!active) return;
    if (!P[active].el()) { active = null; apply(); }
  }, 700);

  addEventListener('resize', function () { if (active) apply(); });

  /* 原来那两个只管自己的兜底清理会把统一让位标志抹掉，这里再盖一次 */
  setInterval(function () {
    if (active && docked) document.documentElement.dataset.lyraSdock = '1';
    else document.documentElement.dataset.lyraSdock = '0';
  }, 1200);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.LyraSide = { show: show, hide: hide };
})();
