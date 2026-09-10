/* Lyra 行情组件 · tickerchart.js
   用法：文中写 <a class="tk" data-sym="AVGO">AVGO</a>，点击弹出行情窗。
   单一版本：本地叠加图（MA5/60/120/200 + MACD + 真 KDJ + RSI + 金叉死叉圆点），用文章快照数据。
   四个面板共用一条十字光标（贯穿显示），主图与最下方 RSI 图带日期轴，顶部有随光标走的读数条。
   数据：assets/data/{SYM}.json 形如 [[date,o,h,l,c,v],...] */
(function () {
  'use strict';
  // 记住脚本自身地址：数据目录跟着它走（/posts/<slug>-latest/ 与带日期的地址都能取到），
  // 刷新时也靠它重新拉自己。re-eval 时 document.currentScript 为空，所以在 window 上留一份。
  var SELF = (document.currentScript && document.currentScript.src) || window.__lyraTkSrc || '';
  if (SELF) window.__lyraTkSrc = SELF;
  var DATA_BASE = SELF ? SELF.split('?')[0].replace(/[^/]*$/, 'data/') : 'assets/data/';
  var LWC = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js';
  // 本地快照里没有的标的，走 quant 服务的公开只读行情接口（无鉴权、只回日线）
  var PUB = 'https://quant.bide.example.com/api/public/bars';
  // 出图所需的最少根数。新上市的标的（LYTE 2026-08-06 上市时只有 19 根）
  // 原来会被 20 根的门槛整个挡掉，只能看到"拿不到行情"。
  var MIN_BARS = 5;

  /* ── 取数：文章快照 + 接口补尾 ──
     assets/data 里的快照是发文那天打包的，之后每一根新收盘都不在里面。
     所以取快照的同时也问一次公开接口，把比快照更新的那几根接到尾巴上。
     接口挂了就用快照，快照没有就只用接口，两边都没有才算取不到。 */
  function fetchSnap(s2, bust) {
    return fetch(DATA_BASE + s2 + '.json' + (bust ? '?v=' + Date.now() : ''))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { return (rows && rows.length) ? rows : null; })
      .catch(function () { return null; });
  }
  function fetchLive(s2) {
    // 接口带 30 分钟浏览器缓存，收盘后半小时内会命中旧的那份，所以强制回源
    return fetch(PUB + '?symbol=' + encodeURIComponent(s2) + '&years=3', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.bars && j.bars.length) ? j.bars : null; })
      .catch(function () { return null; });
  }
  function joinTail(snap, live) {
    if (!snap) return live;
    if (!live) return snap;
    var last = snap[snap.length - 1][0], add = [];
    for (var i = live.length - 1; i >= 0 && live[i][0] > last; i--) add.unshift(live[i]);
    return add.length ? snap.concat(add) : snap;
  }
  /* ── 日线缓存 ──────────────────────────────────────────────
     不缓存的话切一次标的最多打 4 个请求：fetchSeries 本身是「快照 + 接口
     补尾」两个，杠杆 ETF 还要连正股一起拉。来回点几下就是几十个请求。
     内存缓存管住本次会话内的来回切换；localStorage 再留最近 10 只，
     刷新页面也不用重拉。日线一天只变一次，6 小时 TTL 足够。
     bust=true（用户点「重新取」）绕过缓存并覆盖它。 */
  var SER = {}, SERQ = {};
  var SER_TTL = 6 * 3600 * 1000, SER_MAX = 10;
  var SK = 'lyra.tk.bars.', SKI = 'lyra.tk.bars.idx';
  function serIdx() {
    try { return JSON.parse(localStorage.getItem(SKI)) || []; } catch (e) { return []; }
  }
  function serGet(s2) {
    var m = SER[s2];
    if (m && Date.now() - m.at < SER_TTL) return m.rows;
    try {
      var raw = localStorage.getItem(SK + s2);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.at && Date.now() - o.at < SER_TTL && o.rows && o.rows.length) {
          SER[s2] = o;              /* 提到内存，下次不用再解析 */
          return o.rows;
        }
      }
    } catch (e) {}
    return null;
  }
  function serPut(s2, rows) {
    SER[s2] = { at: Date.now(), rows: rows };
    try {
      var idx = serIdx().filter(function (x) { return x !== s2; });
      idx.push(s2);
      /* 超出上限就把最久没看的踢掉，别把 localStorage 塞爆 */
      while (idx.length > SER_MAX) { try { localStorage.removeItem(SK + idx.shift()); } catch (e) {} }
      localStorage.setItem(SK + s2, JSON.stringify({ at: Date.now(), rows: rows }));
      localStorage.setItem(SKI, JSON.stringify(idx));
    } catch (e) {
      /* 配额满了就只留内存缓存，不影响功能 */
      try { serIdx().forEach(function (x) { localStorage.removeItem(SK + x); }); localStorage.removeItem(SKI); } catch (e2) {}
    }
  }
  function clearSeriesCache() {
    SER = {};
    try { serIdx().forEach(function (x) { localStorage.removeItem(SK + x); }); localStorage.removeItem(SKI); } catch (e) {}
  }
  function fetchSeries(s2, bust) {
    if (!bust) {
      var hit = serGet(s2);
      if (hit) return Promise.resolve(hit);
      /* 同一只被并发请求（杠杆和正股同时点）时共用一个请求，别打两遍 */
      if (SERQ[s2]) return SERQ[s2];
    }
    var pr = Promise.all([fetchSnap(s2, bust), fetchLive(s2)])
      .then(function (a) {
        var rows = joinTail(a[0], a[1]);
        if (rows && rows.length) serPut(s2, rows);
        delete SERQ[s2];
        return rows;
      })
      .catch(function (e) { delete SERQ[s2]; throw e; });
    if (!bust) SERQ[s2] = pr;
    return pr;
  }
  /* 杠杆 ETF → 正股。看板里加了杠杆 ETF 会归到正股名下，
     信号与区间一律按正股算，杠杆那只只用来看走势。 */
  var LEV = {
    TQQQ: 'QQQ', QLD: 'QQQ', SQQQ: 'QQQ', QID: 'QQQ', PSQ: 'QQQ',
    UPRO: 'SPY', SPXL: 'SPY', SSO: 'SPY', SPXU: 'SPY', SDS: 'SPY', SH: 'SPY',
    SOXL: 'SOXX', SOXS: 'SOXX', USD: 'SOXX', SNXX: 'SNDK',
    NVDL: 'NVDA', NVDU: 'NVDA', NVDX: 'NVDA', NVDD: 'NVDA',
    TSLL: 'TSLA', TSLT: 'TSLA', TSLQ: 'TSLA',
    AAPU: 'AAPL', AAPD: 'AAPL', MSFU: 'MSFT', MSFD: 'MSFT',
    GGLL: 'GOOGL', GGLS: 'GOOGL', AMUU: 'AMD', AMDL: 'AMD', AMDD: 'AMD',
    AVGG: 'AVGO', AVL: 'AVGO', MUU: 'MU', MUL: 'MU',
    LNOK: 'NOK', VRTL: 'VRT', GEVX: 'GEV', RDWU: 'RDW', COHH: 'COHR', WULX: 'WULF',
    MRVU: 'MRVL', SMCX: 'SMCI', SMCZ: 'SMCI', CONL: 'COIN', MSTX: 'MSTR', MSTU: 'MSTR',
    LITX: 'LITE', LUNL: 'LUNR', PLU: 'PL'
  };
  var LEVX = {
    TQQQ: '3倍做多', QLD: '2倍做多', SQQQ: '3倍做空', QID: '2倍做空', PSQ: '反向',
    UPRO: '3倍做多', SPXL: '3倍做多', SSO: '2倍做多', SPXU: '3倍做空', SDS: '2倍做空', SH: '反向',
    SOXL: '3倍做多', SOXS: '3倍做空', USD: '2倍做多', SNXX: '2倍做多',
    NVDL: '2倍做多', NVDU: '2倍做多', NVDX: '2倍做多', NVDD: '2倍做空',
    TSLL: '2倍做多', TSLT: '2倍做多', TSLQ: '2倍做空',
    AAPU: '2倍做多', AAPD: '2倍做空', MSFU: '2倍做多', MSFD: '2倍做空',
    GGLL: '2倍做多', GGLS: '2倍做空', AMUU: '2倍做多', AMDL: '2倍做多', AMDD: '2倍做空',
    AVGG: '2倍做多', AVL: '2倍做多', MUU: '2倍做多', MUL: '2倍做多',
    LNOK: '2倍做多', VRTL: '2倍做多', GEVX: '2倍做多', RDWU: '2倍做多', COHH: '2倍做多', WULX: '2倍做多',
    MRVU: '2倍做多', SMCX: '2倍做多', SMCZ: '2倍做空', CONL: '2倍做多', MSTX: '2倍做多', MSTU: '2倍做多',
    LITX: '2倍做多', LUNL: '2倍做多', PLU: '2倍做多'
  };
  function underlyingOf(s) { return LEV[String(s || '').toUpperCase()] || null; }
  /* 标的的中文说明：正股给中文名，杠杆 ETF 给「N 倍做多/做空 正股」 */
  function labelOf(s) {
    s = String(s || '').toUpperCase();
    var u = LEV[s];
    if (u) return (LEVX[s] || '杠杆') + u;
    return NAMES[s] || '';
  }

  var EX = {
    NOK: 'NYSE', AVGO: 'NASDAQ', COHR: 'NYSE', VRT: 'NYSE', GEV: 'NYSE', RDW: 'NYSE',
    WULF: 'NASDAQ', MU: 'NASDAQ', LITE: 'NASDAQ', SMCI: 'NASDAQ', NVDA: 'NASDAQ',
    CRWV: 'NASDAQ', CEG: 'NASDAQ', ETN: 'NYSE', RKLB: 'NASDAQ', LUNR: 'NASDAQ',
    BKSY: 'NYSE', LMT: 'NYSE', NOC: 'NYSE'
  };
  var NAMES = {
    NOK: '诺基亚', AVGO: '博通', COHR: 'Coherent', VRT: 'Vertiv', GEV: 'GE Vernova',
    RDW: 'Redwire', WULF: 'TeraWulf', MU: '美光', LITE: 'Lumentum', SMCI: '超微',
    NVDA: '英伟达', CRWV: 'CoreWeave', CEG: 'Constellation', ETN: '伊顿',
    RKLB: 'Rocket Lab', LUNR: 'Intuitive Machines', BKSY: 'BlackSky',
    LMT: '洛克希德', NOC: '诺斯罗普',
    MRVL: '迈威尔', SNDK: 'SanDisk', SOFI: 'SoFi', GHM: 'Graham', MTRN: 'Materion',
    PL: 'Planet Labs', SPCX: 'SpaceX', LYTE: 'Roundhill 光电 ETF',
    QQQ: '纳指100 ETF', SOXX: '费城半导体 ETF', IXIC: '纳斯达克综合指数',
    SPY: '标普500 ETF', SMH: '半导体 ETF', TSM: '台积电', ORCL: '甲骨文', ARM: 'Arm'
  };

  /* ── 服务端元数据 ──
     上面两张表只是兜底。中文名、杠杆映射、分析师一致预期都以服务端为准：
     /api/market/meta 立刻回已经有的，缺的它交给 grok 去查，查到后经 SSE 推回来，
     这里原地把名字补上、把评级条画出来，不打断正在看的图。 */
  var API = (function () { try { return new URL(SELF, location.href).origin; } catch (e) { return ''; } })();
  var ANA = {};            // 正股代码 -> 分析师一致预期
  var NREC = {};           // 代码 -> 服务端原始记录 {zh,en,kind,under,lev}
  var TAGS = {};           // 正股/普通 ETF -> {tags:[...],note}
  var EARN = {};           // 个股 -> 下一次财报 {date,when,fy,fq,confirmed,src}
  var metaSub = null, metaWait = {};

  function applyMeta(j) {
    var hit = false, s2;
    if (j && j.names) for (s2 in j.names) {
      var m2 = j.names[s2];
      NREC[s2] = m2;
      if (m2.zh && m2.zh !== s2 && NAMES[s2] !== m2.zh) { NAMES[s2] = m2.zh; hit = true; }
      if (m2.under && LEV[s2] !== m2.under) { LEV[s2] = m2.under; hit = true; }
      if (m2.under && m2.lev) LEVX[s2] = m2.lev;
      delete metaWait[s2];
    }
    if (j && j.analyst) for (s2 in j.analyst) { ANA[s2] = j.analyst[s2]; delete metaWait[s2]; hit = true; }
    if (j && j.tags) for (s2 in j.tags) { TAGS[s2] = j.tags[s2]; delete metaWait[s2]; hit = true; }
    if (j && j.earnings) for (s2 in j.earnings) { EARN[s2] = j.earnings[s2]; delete metaWait[s2]; hit = true; }
    if (hit) { try { document.dispatchEvent(new CustomEvent('lyra-meta', { detail: j })); } catch (e) {} }
    if (metaSub && !Object.keys(metaWait).length) { try { metaSub.close(); } catch (e) {} metaSub = null; }
  }
  function subscribeMeta() {
    if (metaSub || !window.EventSource || !API) return;
    try { metaSub = new EventSource(API + '/api/market/stream'); } catch (e) { return; }
    metaSub.onmessage = function (ev) { try { applyMeta(JSON.parse(ev.data)); } catch (e) {} };
    // 查一轮要一两分钟，超过 15 分钟还没等到就别一直挂着连接
    setTimeout(function () { if (metaSub) { try { metaSub.close(); } catch (e) {} metaSub = null; } }, 900000);
  }
  function askMeta(list) {
    list = (list || []).filter(Boolean);
    if (!list.length || !API) return Promise.resolve(null);
    return fetch(API + '/api/market/meta?syms=' + encodeURIComponent(list.join(',')), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        applyMeta(j);
        (j.pending || []).forEach(function (x) { metaWait[x] = 1; });
        if (j.pending && j.pending.length) subscribeMeta();
        return j;
      })
      .catch(function () { return null; });
  }
  /* ── 订单 ──
     由页面（看板）通过 setOrders 塞进来，组件只负责画：
     买入在 K 线下方画绿色向上箭头、卖出在上方画红色向下箭头，
     还持有的话在图上画一条均价虚线（移动加权平均，与看板算的是同一套）。 */
  var ORD = {};
  function setOrders(map) {
    ORD = map || {};
    try { document.dispatchEvent(new CustomEvent('lyra-orders')); } catch (e) {}
  }
  function ordersOf(s) { return ORD[String(s || '').toUpperCase()] || []; }
  function posCalc(list) {
    var qty = 0, cost = 0, real = 0;
    (list || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0);
    }).forEach(function (o) {
      var q = +o.qty, pr = +o.price;
      if (o.side === 'sell') {
        var av = qty > 0 ? cost / qty : 0, n = Math.min(q, qty);
        real += (pr - av) * n; qty -= n; cost -= av * n;
        if (qty < 1e-9) { qty = 0; cost = 0; }
      } else { qty += q; cost += q * pr; }
    });
    return { qty: qty, cost: cost, avg: qty > 0 ? cost / qty : null, real: real };
  }

  /* 标签与财报都跟着正股走：杠杆 ETF 自己不打标签、也没有财报 */
  function tagsOf(s) {
    s = String(s || '').toUpperCase();
    var r = TAGS[underlyingOf(s) || s];
    return (r && r.tags) ? r.tags : [];
  }
  function earningsOf(s) {
    s = String(s || '').toUpperCase();
    var r = EARN[underlyingOf(s) || s];
    return (r && r.date) ? r : null;
  }
  /* 杠杆 ETF 没有分析师覆盖，看它正股的 */
  function analystOf(s) {
    s = String(s || '').toUpperCase();
    var a = ANA[underlyingOf(s) || s];
    return (a && a.n) ? a : null;
  }

  /* ══ 指标与区间判定 ══
     实现已抽到 /zones.js（源文件 src/zones.cjs），看板、本组件与 MCP 三处共用同一份。
     这里只留薄壳转发，调用点全部不变；RSI_GAP / RSI_HOT 也从那边读，不要在这里再写一遍。 */
  function LZ() {
    if (!window.LyraZones) throw new Error('zones.js 未加载');
    return window.LyraZones;
  }
  function sma(v, n) { return LZ().sma(v, n); }
  function ema(v, n) { return LZ().ema(v, n); }
  function macd(c) { return LZ().macd(c); }
  function kdj(h, l, c, n) { return LZ().kdj(h, l, c, n); }
  function rsi(c, n) { return LZ().rsi(c, n); }
  function crosses(a, b, label, dates) { return LZ().crosses(a, b, label, dates); }
  function flagZones(flags, gap, minLen, block) { return LZ().flagZones(flags, gap, minLen, block); }
  // 合并之后仍只有一根 K 线的区间直接丢掉：单日触及要等收盘才知道，
  // 事前没法据此操作，画在图上只会误导。
  function rsiZones(vals, test) {
    var f = [], i;
    for (i = 0; i < vals.length; i++) f.push(vals[i] != null && test(vals[i]));
    return flagZones(f, LZ().RSI_GAP, 2);
  }
  /* 每段最后一根加深，表示这一波到此为止。
     注意：只有当这一段确实已经结束时才加深——如果区间一直延伸到最新一根 K 线，
     说明它还在进行中，此时并不知道哪天是最后一天，不加深。 */
  function bandSeries(chart, dates, zs, color, endColor, darkAt) {
    var n = dates.length, mark = [], i;
    for (i = 0; i < n; i++) mark.push(null);
    zs.forEach(function (z, zi) {
      for (var k = z[0]; k <= z[1]; k++) mark[k] = color;
      var d = darkAt ? darkAt[zi] : (z[1] < n - 1 ? z[1] : null);
      if (d != null && mark[d]) mark[d] = endColor;
    });
    var se = chart.addHistogramSeries({
      priceScaleId: 'rsiband', color: color, base: 0,
      priceLineVisible: false, lastValueVisible: false
    });
    se.setData(dates.map(function (d, k) {
      return mark[k] ? { time: d, value: 1, color: mark[k] } : { time: d };
    }));
    chart.priceScale('rsiband').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    return se;
  }

  var css = '.lyra-tkmodal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.lyra-tkmodal.dock{background:transparent;padding:0;justify-content:flex-end;align-items:stretch;pointer-events:none}' +
    '.lyra-tkmodal.dock .lyra-tkbox{width:min(560px,94vw);height:100vh;max-height:100vh;border-radius:0;pointer-events:auto;box-shadow:-10px 0 30px rgba(0,0,0,.2)}' +
    '.lyra-tkmodal.full{padding:0}' +
    '.lyra-tkmodal.full .lyra-tkbox{width:100vw;height:100vh;max-height:100vh;border-radius:0}' +
    '.lyra-tkhead .tools{display:flex;align-items:center;gap:8px;margin-left:auto}' +
    '.lyra-tkicon{border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer;color:var(--text-muted,#718096);padding:2px 4px}' +
    '.lyra-tkicon:hover{color:var(--text-heading,#1a202c)}' +
    '.lyra-tkicon.on{color:var(--accent,#3182ce)}' +
    '.lyra-tkpane{position:relative}' +
    '.lyra-zlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}' +
    '.lyra-zlab{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;' +
    'font-family:var(--font-code,ui-monospace,monospace);font-size:10.5px;line-height:1.35;' +
    'padding:3px 7px;border-radius:6px;border:1px solid;background:var(--surface-page,#fff);opacity:.94}' +
    '.lyra-zlab b{font-weight:700}' +
    '.lyra-zlab .sub{display:block;color:var(--text-muted,#718096);font-size:9.5px}' +
    '.lyra-zlab.g{border-color:rgba(47,133,90,.45);color:#2f855a}' +
    '.lyra-zlab.b{border-color:rgba(43,108,176,.45);color:#2b6cb0}' +
    '.lyra-zlab.a{border-color:rgba(183,121,31,.5);color:#b7791f}' +
    '.lyra-ordm{position:absolute;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;' +
    'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;' +
    'font-family:ui-monospace,monospace;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.3);' +
    'pointer-events:auto;cursor:default}' +
    '.lyra-ordm.b{background:#2f855a}' +
    '.lyra-ordm.s{background:#c53030}' +
    '.lyra-tkrecb{margin-top:14px;cursor:pointer;font-family:inherit;font-size:12.5px;padding:5px 12px;' +
    'border-radius:8px;border:1px solid var(--border-hairline,#e2e8f0);' +
    'background:var(--surface-raised,#edf2f7);color:var(--text-muted,#718096)}' +
    '.lyra-tkrecb:hover{color:var(--accent,#3182ce);border-color:var(--accent,#3182ce)}' +
    '.lyra-tkrecbody{display:none}' +
    '.lyra-tkrecbody.on{display:block}' +
    '.lyra-p2{position:absolute;width:9px;height:9px;transform:translate(-50%,-50%);' +
    'background:#d69e2e;border:1px solid #b7791f;border-radius:50%;pointer-events:none;' +
    'box-shadow:0 1px 3px rgba(0,0,0,.28)}' +
    /* 面板右上角的问号：点开是「将要启动」这个标记的说明 */
    '.lyra-tktop{display:flex;align-items:flex-start;gap:10px;position:relative}' +
    '.lyra-tkacts{display:flex;align-items:center;gap:8px;margin-left:auto;flex:none;min-height:24px}' +
    '.lyra-tkpop{position:relative;flex:none;display:flex;align-items:center}' +

    '.lyra-tkcard{display:none;position:absolute;right:0;top:calc(100% + 7px);z-index:30;'  +
    'width:min(430px,82vw);padding:11px 13px;border-radius:10px;text-align:left;' +
    'border:1px solid var(--border-hairline,#e2e8f0);background:var(--surface-page,#fff);' +
    'box-shadow:0 10px 30px rgba(0,0,0,.16);font-size:12.5px;line-height:1.7;color:var(--text-body,#2d3748)}' +
    '.lyra-tkcard.on{display:block}' +
    '.lyra-tkpill{display:flex;align-items:center;gap:7px;border:0;background:transparent;' +
    'padding:0;cursor:pointer;font-family:inherit;line-height:1}' +
    '.lyra-tkpill .lyra-tkrb{display:flex;width:140px;height:15px;border-radius:8px;overflow:hidden;margin:0;' +
    'box-sizing:border-box;border:1px solid var(--border-hairline,#e2e8f0);background:#edf2f7}' +
    '.lyra-tkpill .lyra-tkrb i{display:block;height:100%;flex:none;font-style:normal;' +
    'box-shadow:inset -1px 0 0 rgba(255,255,255,.55)}' +
    '.lyra-tkpill .lyra-tkrb i:last-child{box-shadow:none}' +
    '.lyra-tkpill .lyra-tkrp{font-family:var(--font-code,ui-monospace,monospace);font-size:11.5px;color:var(--text-muted,#718096)}' +
    '@media (max-width:560px){.lyra-tkpill .lyra-tkrb{width:104px}.lyra-tkpill .lyra-tkrp{display:none}}' +
    '.lyra-tkct{width:100%;border-collapse:collapse;margin:5px 0 3px;' +
    'font-family:var(--font-code,ui-monospace,monospace);font-size:12px}' +
    '.lyra-tkct td{padding:2px 0}' +
    '.lyra-tkct td.r{text-align:right}' +
    '.lyra-tkct td.k{color:var(--text-muted,#718096)}' +
    '.lyra-tkcard .hd{font-weight:600;color:var(--text-heading,#1a202c);margin-bottom:2px}' +
    '.lyra-tkcard .src{color:var(--text-muted,#718096);font-size:11px;margin-top:4px}' +
    '.lyra-tkcard .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}' +
    '.lyra-tktop .lyra-tkrange{margin-bottom:0;min-width:0;overflow-x:auto;scrollbar-width:none}' +
    '.lyra-tktop .lyra-tkrange::-webkit-scrollbar{display:none}' +
    '.lyra-tkhelp{flex:none;width:22px;height:22px;border-radius:50%;cursor:pointer;' +
    'border:1px solid var(--border-hairline,#e2e8f0);background:var(--surface-raised,#edf2f7);' +
    'color:var(--text-muted,#718096);font-family:inherit;font-size:12.5px;line-height:1;padding:0}' +
    '.lyra-tkhelp:hover,.lyra-tkhelp.on{color:#b7791f;border-color:rgba(183,121,31,.55);background:rgba(214,158,46,.14)}' +
    '.lyra-tkexp{border-color:rgba(183,121,31,.4)}' +
    '.lyra-tkexp b{color:var(--text-heading,#1a202c)}' +
    '.lyra-tkexp .dot{display:inline-block;width:9px;height:9px;border-radius:50%;' +
    'background:#d69e2e;border:1px solid #b7791f;vertical-align:0;margin-right:3px}' +
    '.lyra-tkexp p{margin:0 0 6px}' +
    '.lyra-tkexp p:last-child{margin-bottom:0}' +
    '.lyra-tkexp a{color:var(--link,#3182ce)}' +
    '.lyra-ztab{margin-top:14px}' +
    '.lyra-ztab table{width:100%;border-collapse:collapse;font-size:12.5px;font-family:ui-monospace,monospace}' +
    '.lyra-ztab td,.lyra-ztab th{padding:5px 8px;border-bottom:1px solid var(--border-hairline,#e2e8f0);text-align:right}' +
    '.lyra-ztab th{font-size:11px;letter-spacing:.05em;color:var(--text-muted,#718096);text-transform:uppercase;font-weight:600}' +
    '.lyra-ztab td.l,.lyra-ztab th.l{text-align:left}' +
    '.lyra-ztab .tag{display:inline-block;padding:1px 7px;border-radius:5px;font-size:11px;font-weight:600}' +
    '.lyra-ztab .t-g{background:rgba(56,161,105,.14);color:#2f855a}' +
    '.lyra-ztab .t-b{background:rgba(49,130,206,.14);color:#2b6cb0}' +
    '.lyra-ztab .t-a{background:rgba(214,158,46,.18);color:#b7791f}' +
    '.lyra-tkbox{background:var(--surface-page,#fff);color:var(--text-body,#2d3748);border-radius:12px;width:min(1180px,97vw);height:min(880px,94vh);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
    '.lyra-tkhead{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px 0}' +
    '.lyra-tkhead h3{font-size:19px;font-weight:600;margin:0;color:var(--text-heading,#1a202c)}' +
    '.lyra-tkhead .sp{margin-left:auto;display:flex;gap:12px;align-items:center}' +
    '.lyra-tkhead a.ext{font-size:13px;color:var(--link,#3182ce);text-decoration:none}' +
    '.lyra-tkclose{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:var(--text-muted,#718096);padding:0 2px}' +
    '.lyra-tksym{font-family:var(--font-code,ui-monospace,monospace);font-size:13px;padding:5px 10px;width:120px;' +
    'border:1px solid var(--border-hairline,#e2e8f0);border-radius:7px;background:var(--surface-raised,#f7fafc);' +
    'color:var(--text-heading,#1a202c);text-transform:uppercase;outline:none}' +
    '.lyra-tksym:focus{border-color:var(--accent,#3182ce)}' +
    '.lyra-tkgo{border:1px solid var(--border-hairline,#e2e8f0);background:var(--surface-raised,#f7fafc);' +
    'color:var(--text-body,#2d3748);font-size:13px;font-family:inherit;padding:5px 12px;border-radius:7px;cursor:pointer}' +
    '.lyra-tkgo:hover{border-color:var(--accent,#3182ce);color:var(--text-heading,#1a202c)}' +
    '.lyra-tkload{padding:44px 20px;text-align:center;color:var(--text-muted,#718096);font-size:14px}' +
    '.lyra-tkbar{height:3px;max-width:320px;margin:16px auto 0;border-radius:2px;overflow:hidden;background:var(--border-hairline,#e2e8f0)}' +
    '.lyra-tkbar i{display:block;height:100%;width:38%;border-radius:2px;background:var(--accent,#3182ce);animation:lyra-tkslide 1.1s ease-in-out infinite}' +
    '@keyframes lyra-tkslide{0%{transform:translateX(-110%)}100%{transform:translateX(290%)}}' +
    '.lyra-tkrefresh{border:0;background:transparent;font-size:19px;line-height:1;cursor:pointer;color:var(--text-muted,#718096);padding:0 2px}' +
    '.lyra-tkrefresh:hover{color:var(--text-heading,#1a202c)}' +
    '.lyra-tkrefresh.busy{opacity:.45;pointer-events:none;animation:lyra-tkspin .8s linear infinite}' +
    '@keyframes lyra-tkspin{to{transform:rotate(360deg)}}' +
    '.lyra-tkbody{flex:1;min-height:0;overflow:auto;padding:10px 18px 18px}' +
    '.lyra-tkpane{margin-bottom:2px}' +
    /* lightweight-charts 内部用 <table> 布局，正文的全局表格样式会把日期轴挤出容器 —— 这里就地复位 */
    '.lyra-tkpane table{width:auto!important;margin:0!important;border:0!important;border-collapse:separate!important;' +
    'border-spacing:0!important;table-layout:auto!important;background:transparent!important;box-shadow:none!important;font-size:inherit!important}' +
    '.lyra-tkpane thead,.lyra-tkpane tbody,.lyra-tkpane tr{background:transparent!important;border:0!important}' +
    '.lyra-tkpane td,.lyra-tkpane th{padding:0!important;margin:0!important;border:0!important;background:transparent!important;' +
    'vertical-align:middle!important;line-height:normal!important;text-align:left!important;font-size:inherit!important;white-space:normal!important}' +
    '.lyra-tktitle{font-size:13.5px;color:var(--text-muted,#718096);margin:8px 0 2px}' +
    '.lyra-tktitle b{font-family:var(--font-code,ui-monospace,monospace);font-size:15px;color:var(--text-heading,#1a202c)}' +
    '.lyra-tktitle span{color:var(--text-body,#2d3748)}' +
    '.lyra-tktitle i{font-style:normal;font-size:12px;opacity:.8;margin-left:6px}' +
    '.lyra-tkread{font-size:12.5px;font-family:ui-monospace,monospace;color:var(--text-body,#2d3748);margin:2px 0 8px;min-height:17px;letter-spacing:.2px}' +
    '.lyra-tkread .dt{font-weight:600;color:var(--text-heading,#1a202c);margin-right:10px}' +
    '.lyra-tkread .up{color:#2f855a;font-weight:600}.lyra-tkread .dn{color:#c53030;font-weight:600}' +
    '.lyra-tklegend{font-size:12px;color:var(--text-muted,#718096);margin:2px 0 4px;display:flex;gap:14px;flex-wrap:wrap;min-height:15px}' +
    '.lyra-tklegend i{display:inline-block;width:14px;height:3px;vertical-align:3px;margin-right:5px;border-radius:2px}' +
    '.lyra-tklegend i.dot{width:9px;height:9px;border-radius:50%;vertical-align:0}' +
    '.lyra-tklegend i.band{width:8px;height:14px;border-radius:2px;vertical-align:-3px;border:1px solid rgba(0,0,0,.06)}' +
    '.lyra-tklegend b{font-weight:600;margin-left:5px;font-family:ui-monospace,monospace;color:var(--text-body,#2d3748);' +
    'display:inline-block;min-width:5.5ch;text-align:right;font-variant-numeric:tabular-nums}' +
    '.lyra-tkread .n{display:inline-block;min-width:6.5ch;text-align:right;font-variant-numeric:tabular-nums}' +
    '.lyra-tkread .sess{display:inline-block;border:1px solid var(--border-hairline,#e2e8f0);border-radius:999px;' +
      'padding:0 7px;font-size:10.5px;color:var(--text-muted,#718096);margin-right:8px;font-family:inherit}' +
    '.lyra-tkread .lag{display:block;font-size:10.5px;color:var(--text-muted,#a0aec0);margin-top:2px;letter-spacing:0}' +
    '.lyra-sesslay{position:absolute;inset:0;pointer-events:none;overflow:hidden}' +
    '.lyra-sessb{position:absolute;top:0;bottom:0}' +
    '.lyra-tkread .p{display:inline-block;min-width:7ch;text-align:right;font-variant-numeric:tabular-nums}' +
    '.lyra-tkrange{display:inline-flex;gap:2px;background:var(--surface-raised,#edf2f7);border-radius:8px;padding:3px;margin:0 0 8px}' +
    '.lyra-tkrange button{border:0;background:transparent;color:var(--text-muted,#718096);font-size:12.5px;font-family:inherit;padding:5px 11px;border-radius:6px;cursor:pointer;line-height:1}' +
    '.lyra-tkrange button.on{background:var(--surface-page,#fff);color:var(--text-heading,#1a202c);font-weight:600;box-shadow:0 1px 2px rgba(16,24,40,.10)}' +
    '.lyra-tkrange i.sep{width:1px;align-self:stretch;margin:2px 4px;background:var(--border-hairline,#cbd5e0);opacity:.7}' +
    '.lyra-sessd{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed var(--border-hairline,#cbd5e0)}' +
    '.lyra-sessl{position:absolute;top:2px;font-size:10px;color:var(--text-muted,#718096);padding:0 4px;white-space:nowrap}' +
    '.lyra-xtab{margin-top:12px;border-top:1px solid var(--border-hairline,#e2e8f0);padding-top:10px}' +
    '.lyra-xtab table{width:100%;border-collapse:collapse;font-size:12.5px;font-family:ui-monospace,monospace}' +
    '.lyra-xtab td{padding:5px 8px;border-bottom:1px solid var(--border-hairline,#e2e8f0)}' +
    '.lyra-xtab .g{color:#2f855a;font-weight:600}.lyra-xtab .d{color:#c53030;font-weight:600}' +
    'a.tk{color:var(--link,#3182ce);border-bottom:1px dashed currentColor;cursor:pointer;font-family:ui-monospace,monospace;text-decoration:none}' +
    '.lyra-tkerr{padding:30px;text-align:center;color:var(--text-muted,#718096);font-size:14px;line-height:1.8}';

  function inject() {
    var el = document.getElementById('lyra-tk-css');
    if (!el) { el = document.createElement('style'); el.id = 'lyra-tk-css'; document.head.appendChild(el); }
    el.textContent = css;
  }
  /* zones.js 是区间/档位的唯一实现，画图与 analyze 都要用它。
     看板页面自己有 <script src="/zones.js">，文章页没有，所以这里兜底加载。 */
  function loadZones(cb) {
    if (window.LyraZones) return cb();
    var z = document.createElement('script'); z.src = '/zones.js';
    z.onload = function () { cb(); };
    z.onerror = function () { cb(new Error('zones')); };
    document.head.appendChild(z);
  }
  function loadLib(cb) {
    if (!window.LyraZones) {
      return loadZones(function (ze) { if (ze) return cb(ze); loadLib(cb); });
    }
    if (window.LightweightCharts) return cb();
    var s = document.createElement('script'); s.src = LWC;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('lib')); };
    document.head.appendChild(s);
  }
  function isDark() {
    var t = (document.body && document.body.getAttribute('data-lyra-theme')) ||
      document.documentElement.getAttribute('data-lyra-theme') || '';
    /* home 是深空皮肤，也是深色的：看板的「深」主题走的就是 home，
       漏掉它会让网格线、蜡烛和覆盖层按浅色算，深色下几乎看不见。 */
    return t === 'magazine' || t === 'tech' || t === 'home';
  }

  function pane(box, h) { var d = document.createElement('div'); d.className = 'lyra-tkpane'; d.style.height = h + 'px'; box.appendChild(d); return d; }
  function legend(box, items) {
    var d = document.createElement('div'); d.className = 'lyra-tklegend';
    var vs = [];
    items.forEach(function (x) {
      var s = document.createElement('span');
      // x[3] = 'dot' 圆点（金叉死叉那类点状标记）/ 'band' 竖条（区间色带）/ 默认横线（均线）
      s.innerHTML = '<i class="' + (x[3] || '') + '" style="background:' + x[1] + '"></i>' + x[0];
      if (x[2] !== false) { var v = document.createElement('b'); s.appendChild(v); vs.push(v); }
      d.appendChild(s);
    });
    box.appendChild(d);
    vs.box = d;
    return vs;
  }
  function line(chart, color, w) {
    return chart.addLineSeries({ color: color, lineWidth: w || 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  }
  // 用 whitespace 点补齐前置空值，四张图的 logical index 才和 K 线一一对应（否则十字光标会错位）
  function pack(dates, vals) {
    var o = [];
    for (var i = 0; i < dates.length; i++) {
      o.push((vals[i] != null && isFinite(vals[i])) ? { time: dates[i], value: vals[i] } : { time: dates[i] });
    }
    return o;
  }
  function fmt(v, d) { return (v == null || !isFinite(v)) ? '—' : v.toFixed(d == null ? 2 : d); }

  /* ══ 日内图 ══════════════════════════════════════════════════
     数据走 /api/bg/candles（Bitget Stock+ 只读行情），两条硬约束：
       · 夜盘（美东 20:00–04:00）拿不到，它属于 LV1 档而 LV1 卡只在 APP 里
         生效。所以一天只有 盘前+盘中+盘后 共 16 小时、480 根 Min_2。
         lightweight-charts 的时间轴只包含喂进去的点、不给缺失区间留空，
         所以「跳过夜盘」是默认行为，不用额外处理。
       · 行情固定滞后约 15 分钟，右端永远缺最近一刻钟，读数行如实标出来。
     日内图纯展示：区间/RSI/均线/金叉那套判定一律按日线收盘算，不受这里影响。 */
  var INTRA_OK = null;   /* null=没探过 true/false=探过 */
  function intraProbe() {
    if (INTRA_OK !== null) return Promise.resolve(INTRA_OK);
    return fetch('/api/bg/candles?sym=SPY&period=Min_2&count=10', { credentials: 'same-origin' })
      .then(function (r) { INTRA_OK = r.ok; return INTRA_OK; })
      .catch(function () { INTRA_OK = false; return false; });
  }
  /* 美东挂钟时间。lightweight-charts 把 UNIX 时间当 UTC 显示，所以把每根
     K 线的「美东挂钟」当成 UTC 喂进去，轴上显示的就是美东时间。逐根算偏移，
     夏令时切换那天也不会错一小时。 */
  var ETF = null;
  function etParts(ms) {
    if (!ETF) ETF = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    var o = {};
    ETF.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    if (o.hour === '24') o.hour = '00';
    return o;
  }
  function etDay(ms) { var p = etParts(ms); return p.year + '-' + p.month + '-' + p.day; }
  function etShift(ms) {
    var p = etParts(ms);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 1000;
  }

  /* 周期条（日内图与日线图共用一套，位置和顺序不变，切来切去按钮不跳）：
       [1日 5日] | [日 周 月] | [1M 3M 6M YTD 1Y 3Y 全部] | [均线 BOLL]
     1日/5日 = 日内图；日/周/月 = K 线周期；右边一组是日线图的显示区间；
     最右是主图叠加。日内探测失败时把 1日/5日 藏起来。 */
  function buildBar(bar, cur, on) {
    var groups = [];
    function grp(items, key) {
      if (groups.length) { var sp = document.createElement('i'); sp.className = 'sep'; bar.appendChild(sp); }
      var bs = items.map(function (it) {
        var b = document.createElement('button'); b.type = 'button';
        b.textContent = it[0]; b.setAttribute('data-g', key);
        if (cur[key] === it[1]) b.className = 'on';
        b.onclick = function () {
          [].forEach.call(bar.querySelectorAll('button[data-g="' + key + '"]'), function (x) { x.className = ''; });
          b.className = 'on'; on(key, it[1]);
        };
        bar.appendChild(b); return b;
      });
      groups.push(bs); return bs;
    }
    var intra = grp([['1日', 1], ['5日', 5]], 'intra');
    intra.forEach(function (b) { b.style.display = 'none'; });
    grp([['日', 'D'], ['周', 'W'], ['月', 'M']], 'tf');
    grp([['1M', 31], ['3M', 92], ['6M', 183], ['YTD', 'ytd'], ['1Y', 366], ['3Y', 1096], ['全部', null]], 'range');
    grp([['均线', 'ma'], ['BOLL', 'boll']], 'main');
    intraProbe().then(function (ok) { if (ok) intra.forEach(function (b) { b.style.display = ''; }); });
    return bar;
  }

  var SESSN = { p: '盘前', r: '盘中', o: '盘后', n: '夜盘' };
  var SESSC = { p: 'rgba(49,130,206,.10)', r: null, o: 'rgba(214,158,46,.12)', n: 'rgba(128,90,213,.12)' };

  /* 固定三段时段轴（美东分钟数）：盘前 04:00–09:30、盘中 09:30–16:00、盘后 16:00–20:00。
     横轴不随数据伸缩：每个交易日的槽位是固定的，K 线只落进有成交的槽，
     还没走到的槽留白——和券商 App 的日内图一样。
     盘中用细周期、盘前盘后用粗周期（LWC 每根等宽，只能这样把延长时段压窄）：
       1日：盘中 Min_2（195 根）、盘前/盘后 Min_5（66 + 48 根），三段占比约 21/63/16
       5日：盘中 Min_5（78 根）、盘前/盘后 Min_15（22 + 16 根），五天 580 根 */
  var SESS_MIN = { p: [240, 570], r: [570, 960], o: [960, 1200] };
  var INTRA_CFG = { 1: { fine: 'Min_2', fineMin: 2, coarse: 'Min_5', coarseMin: 5 },
                    5: { fine: 'Min_5', fineMin: 5, coarse: 'Min_15', coarseMin: 15 } };
  function etMinute(ms) { var p = etParts(ms); return (+p.hour) * 60 + (+p.minute); }
  function sessOf(min) {
    if (min >= SESS_MIN.p[0] && min < SESS_MIN.p[1]) return 'p';
    if (min >= SESS_MIN.r[0] && min < SESS_MIN.r[1]) return 'r';
    if (min >= SESS_MIN.o[0] && min < SESS_MIN.o[1]) return 'o';
    return null;
  }
  function hm(min) { var h = Math.floor(min / 60), m2 = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m2 < 10 ? '0' : '') + m2; }

  function renderIntra(host, sym, rows, lead, nDays) {
    if (host.__lyraIntraTimer) { clearInterval(host.__lyraIntraTimer); host.__lyraIntraTimer = null; }
    nDays = nDays === 5 ? 5 : 1;
    var CFG = INTRA_CFG[nDays];
    host.innerHTML = '';
    var top = document.createElement('div'); top.className = 'lyra-tktop'; host.appendChild(top);
    var bar = document.createElement('div'); bar.className = 'lyra-tkrange'; top.appendChild(bar);
    var read = document.createElement('div'); read.className = 'lyra-tkread';
    read.textContent = '正在取日内行情…'; host.appendChild(read);
    buildBar(bar, { intra: nDays, main: mainMode() }, function (key, v) {
      if (key === 'intra') { if (v !== nDays) renderIntra(host, sym, rows, lead, v); return; }
      if (key === 'tf') { renderLocal(host, sym, rows, lead, undefined, v); return; }
      if (key === 'range') { renderLocal(host, sym, rows, lead, v, 'D'); return; }
      if (key === 'main') { try { localStorage.setItem(MAINK, v); } catch (e) {} }
    });

    function get(period) {
      return fetch('/api/bg/candles?sym=' + encodeURIComponent(sym) + '&period=' + period + '&count=1000',
                   { credentials: 'same-origin', cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { return j.bars || []; });
    }
    function load() { return Promise.all([get(CFG.fine), get(CFG.coarse)]); }

    var built = false, charts = [], panes = [], cP, cV, cand, volS, vwS = {}, olay, bandEls = [], SL = [], byT = {}, lastMs = 0;
    load().then(function (a) { draw(a[0], a[1]); })
      .catch(function (e) {
        read.innerHTML = '<span class="dt">拿不到日内行情</span>' +
          (String(e.message) === '403' ? '需要登录' : '接口出错，请稍后再试');
      });

    /* 把两套周期的 K 线装进固定槽位。返回槽位数组，每个槽 {t,d,s,b}：
       t 伪 UTC 秒（美东挂钟当 UTC 用，轴上显示美东时间）、d 美东日期、
       s 时段、b 该槽的 K 线（没有就是 null，图上留白）。 */
    function fill(fine, coarse) {
      var seen = {}, days = [];
      coarse.concat(fine).forEach(function (b) {
        if (sessOf(etMinute(b[0])) == null) return;
        var d = etDay(b[0]); if (!seen[d]) { seen[d] = 1; days.push(d); }
      });
      days.sort(); days = days.slice(-nDays);
      var keep = {}; days.forEach(function (d) { keep[d] = 1; });
      var slots = [], key = {};
      days.forEach(function (d) {
        var base = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000;
        ['p', 'r', 'o'].forEach(function (s) {
          var step = s === 'r' ? CFG.fineMin : CFG.coarseMin;
          for (var m = SESS_MIN[s][0]; m < SESS_MIN[s][1]; m += step) {
            key[d + '|' + s + '|' + m] = slots.length;
            slots.push({ t: base + m * 60, d: d, s: s, m: m, b: null });
          }
        });
      });
      function put(list, wantR) {
        list.forEach(function (b) {
          var d = etDay(b[0]); if (!keep[d]) return;
          var min = etMinute(b[0]), s = sessOf(min); if (!s) return;
          if ((s === 'r') !== wantR) return;
          var step = s === 'r' ? CFG.fineMin : CFG.coarseMin;
          var m = SESS_MIN[s][0] + Math.floor((min - SESS_MIN[s][0]) / step) * step;
          var i = key[d + '|' + s + '|' + m]; if (i == null) return;
          var sl = slots[i];
          if (!sl.b) sl.b = [b[0], b[1], b[2], b[3], b[4], b[5] || 0, s, b[7] || b[4] * (b[5] || 0)];
          else {   // 同一槽两根（时段边界偶发）：合成一根
            var o = sl.b; o[2] = Math.max(o[2], b[2]); o[3] = Math.min(o[3], b[3]); o[4] = b[4];
            o[5] += (b[5] || 0); o[7] += (b[7] || b[4] * (b[5] || 0));
          }
        });
      }
      put(fine, true); put(coarse, false);
      return slots;
    }

    function draw(fine, coarse) {
      SL = fill(fine, coarse);
      if (!SL.some(function (x) { return x.b; })) { read.textContent = '日内行情为空'; return; }
      var dark = isDark(), grid = dark ? '#2c2c2a' : '#e2e8f0';
      var LC = window.LightweightCharts;
      function fmtTick(t) {
        var dt = new Date(t * 1000), mm = dt.getUTCHours() * 60 + dt.getUTCMinutes();
        if (mm === SESS_MIN.p[0]) return (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate();
        return hm(mm);
      }
      if (!built) {
        built = true;
        function mk(h, showTime) {
          var el = pane(host, h);
          var c = LC.createChart(el, {
            width: Math.max(320, el.clientWidth || 900), height: h,
            layout: { background: { color: 'transparent' }, textColor: dark ? '#8b9099' : '#718096', fontSize: 11 },
            grid: { vertLines: { color: grid }, horzLines: { color: grid } },
            rightPriceScale: { borderColor: grid, minimumWidth: 64,
              scaleMargins: showTime ? { top: 0.10, bottom: 0.10 } : { top: 0.18, bottom: 0 }, autoScale: true },
            timeScale: { borderColor: grid, rightOffset: 0, visible: !!showTime, fixLeftEdge: true, fixRightEdge: true,
              lockVisibleTimeRangeOnResize: true, borderVisible: true, timeVisible: true, secondsVisible: false,
              tickMarkFormatter: function (t) { return fmtTick(t); } },
            localization: { timeFormatter: function (t) {
              var dt = new Date(t * 1000);
              return dt.toISOString().slice(5, 10).replace('-', '/') + ' ' + hm(dt.getUTCHours() * 60 + dt.getUTCMinutes()); } },
            crosshair: { mode: 0, vertLine: { labelVisible: !!showTime } },
            handleScroll: false, handleScale: false
          });
          charts.push(c); panes.push(el); return c;
        }
        cP = mk(320, false); cV = mk(90, true);
        cand = cP.addCandlestickSeries({
          upColor: '#2f855a', downColor: '#c53030', borderVisible: false,
          wickUpColor: '#2f855a', wickDownColor: '#c53030', priceLineVisible: true, lastValueVisible: true
        });
        volS = cV.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false,
          priceFormat: { type: 'volume' } });   // 轴上写 400K / 1.2M，别写 400000.00
        olay = document.createElement('div'); olay.className = 'lyra-sesslay';
        panes[0].insertBefore(olay, panes[0].firstChild);
        var syncing = false;
        charts.forEach(function (a) {
          a.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
            if (syncing || !r) return;
            syncing = true;
            charts.forEach(function (b2) { if (b2 !== a) b2.timeScale().setVisibleLogicalRange(r); });
            syncing = false;
            placeBands();
          });
        });
        /* 十字光标贯穿两格：K 线格和成交量格各自只画自己的光标，
           这里手工把另一格的光标设到同一个时间上（和日线那四联动同一套做法），
           不然在成交量格上看不到竖线，对不上时间。
           拖动时不跟随，松手再恢复。 */
        var anchors = [{ get s() { return cand; }, v: function (i) { var b = SL[i] && SL[i].b; return b ? b[4] : null; } },
                       { get s() { return volS; }, v: function (i) { var b = SL[i] && SL[i].b; return b ? b[5] : 0; } }];
        var busy = false, dragging = false;
        panes.forEach(function (pe) { pe.addEventListener('pointerdown', function () { dragging = true; }); });
        var upFn = function () {
          if (!dragging) return;
          dragging = false;
          charts.forEach(function (c) { try { c.clearCrosshairPosition(); } catch (e) {} });
        };
        document.addEventListener('pointerup', upFn);
        document.addEventListener('pointercancel', upFn);
        charts.forEach(function (from, fi) {
          from.subscribeCrosshairMove(function (p) {
            if (busy) return;
            var live = !!(p && p.point && p.time != null);
            var i = live ? byT[p.time] : null;
            show(i == null ? null : i);
            if (dragging) return;
            busy = true;
            charts.forEach(function (c, j) {
              if (c === from) return;
              if (!live || i == null) { try { c.clearCrosshairPosition(); } catch (e) {} return; }
              var v = anchors[j].v(i);
              if (v == null || !isFinite(v)) v = 0;
              try { c.setCrosshairPosition(v, p.time, anchors[j].s); } catch (e) {}
            });
            busy = false;
          });
        });
      }
      /* 数据：每个槽一条，没成交的槽是 whitespace（只有 time），轴照样铺满 */
      cand.setData(SL.map(function (x) {
        return x.b ? { time: x.t, open: x.b[1], high: x.b[2], low: x.b[3], close: x.b[4] } : { time: x.t };
      }));
      volS.setData(SL.map(function (x) {
        return x.b ? { time: x.t, value: x.b[5], color: x.b[4] >= x.b[1] ? '#2f855a' : '#c53030' } : { time: x.t };
      }));
      /* 分时均价 = 累计成交额 / 累计成交量，每个交易日归零，一天一条独立的线
         （跨日不能连）。均价存回槽位供读数行用。 */
      var perDay = {}, cumT = 0, cumV = 0, curDay = null;
      SL.forEach(function (x) {
        if (x.d !== curDay) { curDay = x.d; cumT = 0; cumV = 0; perDay[x.d] = []; }
        if (!x.b) { x.vw = null; return; }
        cumT += x.b[7]; cumV += x.b[5];
        x.vw = cumV > 0 ? cumT / cumV : x.b[4];
        perDay[x.d].push({ time: x.t, value: x.vw });
      });
      var dayList = Object.keys(perDay).sort();
      dayList.forEach(function (d, k) {
        if (!vwS[d]) vwS[d] = cP.addLineSeries({ color: '#d69e2e', lineWidth: 2, priceLineVisible: false,
          lastValueVisible: k === dayList.length - 1, crosshairMarkerVisible: false });
        vwS[d].setData(perDay[d]);
      });
      byT = {}; SL.forEach(function (x, i) { byT[x.t] = i; });
      lastMs = 0; SL.forEach(function (x) { if (x.b && x.b[0] > lastMs) lastMs = x.b[0]; });

      /* 时段底色：按固定槽位算区间，用绝对定位 div 铺在 canvas 底下；
         5日在每天开头加一条虚线分隔 + 日期小字 */
      olay.innerHTML = ''; bandEls = [];
      var segs = [];
      SL.forEach(function (x, i) {
        var last2 = segs[segs.length - 1];
        if (!last2 || last2.d !== x.d || last2.s !== x.s) segs.push({ d: x.d, s: x.s, a: i, b: i });
        else last2.b = i;
      });
      segs.forEach(function (g, k) {
        var el = document.createElement('div'); el.className = 'lyra-sessb';
        el.style.background = SESSC[g.s] || 'transparent'; olay.appendChild(el);
        var dv = null, lb = null;
        if (g.s === 'p') {
          if (k > 0) { dv = document.createElement('div'); dv.className = 'lyra-sessd'; olay.appendChild(dv); }
          if (nDays > 1) { lb = document.createElement('div'); lb.className = 'lyra-sessl'; lb.textContent = g.d.slice(5).replace('-', '/'); olay.appendChild(lb); }
        }
        bandEls.push({ g: g, el: el, dv: dv, lb: lb });
      });
      show(null);
      alignScales();
      setTimeout(alignScales, 0);
      if (!host.__lyraIntraResize) {
        host.__lyraIntraResize = onResize;
        window.addEventListener('resize', onResize);
      }
      onResize();
    }

    /* 两格的右侧价格轴必须一样宽，K 线和成交量的横轴才对得齐：
       成交量轴的标签比价格宽（或窄），LWC 各自算出的轴宽不同，fitContent 后
       每根的间距就不一样。取两格里较宽的那个当两格的最小宽度，再各自 fitContent。 */
    function alignScales() {
      if (!built) return;
      var w = 64;
      charts.forEach(function (c) { try { w = Math.max(w, c.priceScale('right').width()); } catch (e) {} });
      charts.forEach(function (c) { c.applyOptions({ rightPriceScale: { minimumWidth: w } }); });
      charts.forEach(function (c) { c.timeScale().fitContent(); });
      placeBands();
    }
    function placeBands() {
      if (!cP) return;
      var sc = cP.timeScale(), w = panes[0].clientWidth || 0, bs = sc.options().barSpacing || 2;
      bandEls.forEach(function (o) {
        var x1 = sc.timeToCoordinate(SL[o.g.a].t), x2 = sc.timeToCoordinate(SL[o.g.b].t);
        if (x1 == null || x2 == null) { o.el.style.display = 'none'; if (o.dv) o.dv.style.display = 'none'; if (o.lb) o.lb.style.display = 'none'; return; }
        var l = Math.max(0, Math.min(x1, x2) - bs / 2), r2 = Math.min(w, Math.max(x1, x2) + bs / 2);
        if (o.dv) { o.dv.style.display = ''; o.dv.style.left = l + 'px'; }
        if (o.lb) { o.lb.style.display = ''; o.lb.style.left = Math.max(2, l) + 'px'; }
        if (!SESSC[o.g.s] || r2 <= l) { o.el.style.display = 'none'; return; }
        o.el.style.display = ''; o.el.style.left = l + 'px'; o.el.style.width = (r2 - l) + 'px';
      });
    }
    function nb(v, d) { return '<span class="n">' + fmt(v, d) + '</span>'; }
    function show(i) {
      if (!SL.length) return;
      if (i == null || i < 0 || i >= SL.length) { i = SL.length - 1; }
      while (i > 0 && !SL[i].b) i--;      // 光标落在空槽上就读它左边最近的一根
      var x = SL[i], b = x.b;
      var lagMin = Math.max(0, Math.round((Date.now() - lastMs) / 60000));
      var lag = '<span class="lag">美东时间 · 落后约 ' + lagMin + ' 分钟 · 夜盘无数据</span>';
      if (!b) { read.innerHTML = '<span class="dt">' + x.d + '</span>暂无成交' + lag; return; }
      var j = i - 1; while (j >= 0 && (!SL[j].b || SL[j].d !== x.d)) j--;
      var prev = j >= 0 ? SL[j].b[4] : b[1];
      var ch = prev ? (b[4] / prev - 1) * 100 : 0;
      read.innerHTML = '<span class="dt">' + x.d + ' ' + hm(x.m) + '</span>' +
        '<span class="sess">' + (SESSN[x.s] || '') + '</span>' +
        '　开 ' + nb(b[1]) + '　高 ' + nb(b[2]) + '　低 ' + nb(b[3]) + '　收 ' + nb(b[4]) +
        '　<span class="p ' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</span>' +
        '　均价 ' + nb(x.vw) +
        '　量 <span class="n">' + (b[5] >= 1e6 ? (b[5] / 1e6).toFixed(2) + 'M' : Math.round(b[5])) + '</span>' + lag;
    }
    function onResize() {
      if (!document.body.contains(host)) { window.removeEventListener('resize', onResize); host.__lyraIntraResize = null; return; }
      if (!built) return;
      var cap = Math.max(260, Math.round((window.innerHeight || 800) * 0.72));
      var used = 0;
      [].forEach.call(host.children, function (el) {
        if (!el.classList.contains('lyra-tkpane')) used += el.offsetHeight;
      });
      var h0 = Math.max(240, Math.min(cap - 90, (host.clientHeight || 700) - 28 - used - 90));
      panes[0].style.height = h0 + 'px';
      charts[0].applyOptions({ width: Math.max(320, panes[0].clientWidth || 900), height: h0 });
      charts[1].applyOptions({ width: Math.max(320, panes[1].clientWidth || 900), height: 90 });
      alignScales();
    }
    if (host.__lyraIntraResize) { window.removeEventListener('resize', host.__lyraIntraResize); host.__lyraIntraResize = null; }
    /* 每 60 秒补一次尾（服务端本来就缓存 60 秒，更快无意义）；页面不可见时跳过；
       图被换掉（host 里已没有这套 pane）就自己停 */
    host.__lyraIntraTimer = setInterval(function () {
      if (!document.body.contains(host) || !panes.length || !host.contains(panes[0])) {
        clearInterval(host.__lyraIntraTimer); host.__lyraIntraTimer = null; return;
      }
      if (document.hidden || !built) return;
      load().then(function (a) { if (host.contains(panes[0])) draw(a[0], a[1]); }).catch(function () {});
    }, 60000);
  }

  /* ── 周线 / 月线：由日线在前端聚合，不另取数 ──
     周按美东周一到周五（ISO 周），月按自然月；开=首根开、高=最高、低=最低、
     收=末根收、量求和；K 线的日期用该周期最后一个交易日，订单标记按日期吸附
     时自然落到所属的那一周/月。最后一根未走完的周/月照样画，读数行标「进行中」。
     周线月线只是看看：区间/将要启动那套判定一律按日线，聚合视图里不画。 */
  function tfKey(d, tf) {
    if (tf === 'M') return d.slice(0, 7);
    var t = new Date(d + 'T00:00:00Z'), dow = (t.getUTCDay() + 6) % 7;   // 周一=0
    t.setUTCDate(t.getUTCDate() - dow);
    return t.toISOString().slice(0, 10);
  }
  /* 这一根周/月线后面还有没有交易日：周看是不是周五，月看是不是当月最后一个工作日
     （节假日不管，最多把「进行中」多标一天） */
  function periodOpen(d) {
    var t = new Date(d + 'T00:00:00Z');
    if (TF_CUR === 'W') return t.getUTCDay() !== 5;
    var e = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0));
    while (e.getUTCDay() === 0 || e.getUTCDay() === 6) e.setUTCDate(e.getUTCDate() - 1);
    return e.toISOString().slice(0, 10) !== d;
  }
  var TF_CUR = 'D';
  function aggregate(rows, tf) {
    var out = [], cur = null, key = null;
    rows.forEach(function (r) {
      var k = tfKey(r[0], tf);
      if (k !== key) { key = k; cur = [r[0], r[1], r[2], r[3], r[4], r[5] || 0, [r[0]]]; out.push(cur); return; }
      cur[0] = r[0]; cur[2] = Math.max(cur[2], r[2]); cur[3] = Math.min(cur[3], r[3]);
      cur[4] = r[4]; cur[5] += (r[5] || 0); cur[6].push(r[0]);
    });
    return out;
  }
  function aggregateMap(map, dates, tf) {
    var out = {}, cur = null, key = null;
    dates.forEach(function (d) {
      var r = map[d], k = tfKey(d, tf);
      if (k !== key) { key = k; cur = null; }
      if (!r) return;
      if (!cur) cur = [r[0], r[1], r[2], r[3]];
      else { cur[1] = Math.max(cur[1], r[1]); cur[2] = Math.min(cur[2], r[2]); cur[3] = r[3]; }
      out[d] = cur;
    });
    /* 键必须是聚合后那根 K 线的日期（周期最后一个交易日）：
       上面逐日写入时每一天都指向同一个数组，所以最后一天的键就是对的 */
    return out;
  }
  /* 布林带 (20, 2)：中轨 SMA20，上下轨 ±2 倍总体标准差（券商与 TradingView 同一算法） */
  function boll(c, n, k) {
    var mid = sma(c, n), up = [], lo = [], s = 0, s2 = 0;
    for (var i = 0; i < c.length; i++) {
      s += c[i]; s2 += c[i] * c[i];
      if (i >= n) { s -= c[i - n]; s2 -= c[i - n] * c[i - n]; }
      if (i >= n - 1) { var sd = Math.sqrt(Math.max(0, s2 / n - (s / n) * (s / n))); up.push(mid[i] + k * sd); lo.push(mid[i] - k * sd); }
      else { up.push(null); lo.push(null); }
    }
    return { mid: mid, up: up, lo: lo };
  }
  var MAINK = 'lyra.tk.main';   /* 主图叠加：ma / boll */
  function mainMode() { try { return localStorage.getItem(MAINK) === 'boll' ? 'boll' : 'ma'; } catch (e) { return 'ma'; } }

  function renderLocal(host, sym, rows, lead, initRange, tf) {
    if (host.__lyraIntraTimer) { clearInterval(host.__lyraIntraTimer); host.__lyraIntraTimer = null; }
    if (host.__lyraIntraResize) { window.removeEventListener('resize', host.__lyraIntraResize); host.__lyraIntraResize = null; }
    host.innerHTML = '';
    var TF = tf === 'W' || tf === 'M' ? tf : 'D', DAILY = TF === 'D';
    TF_CUR = TF;
    var rowsD = rows, leadD = lead;
    if (!DAILY) {
      rows = aggregate(rowsD, TF);
      if (lead && lead.map) lead = { sym: lead.sym, map: aggregateMap(lead.map, rowsD.map(function (r) { return r[0]; }), TF) };
    }
    var dates = rows.map(function (r) { return r[0]; });
    var open_ = rows.map(function (r) { return r[1]; });
    var high = rows.map(function (r) { return r[2]; });
    var low = rows.map(function (r) { return r[3]; });
    var close = rows.map(function (r) { return r[4]; });
    var vol = rows.map(function (r) { return r[5]; });
    var idx = {}; dates.forEach(function (d, i) { idx[d] = i; });
    var ma5 = sma(close, 5), ma20 = sma(close, 20), ma60 = sma(close, 60), ma120 = sma(close, 120), ma200 = sma(close, 200);
    var m = macd(close), kd = kdj(high, low, close), rs = rsi(close, 14);
    // 只检测均线与 MACD 的交叉。KDJ 叉得太密（平均 6 根一次）不算；
    // RSI 的 30/70 不按点算，改成主图上的区间带——它本来就是一段时间而不是一天
    var xs = []
      .concat(crosses(ma5, ma60, 'MA5 × MA60', dates))
      .concat(crosses(ma60, ma200, 'MA60 × MA200', dates))
      .concat(crosses(m.dif, m.dea, 'MACD DIF × DEA', dates));
    xs.sort(function (a, b) { return a.i - b.i; });

    var dark = isDark();
    var grid = dark ? '#2c2c2a' : '#e2e8f0';
    var LC = window.LightweightCharts, charts = [], anchors = [];
    var panes = [];
    function mkChart(h, showTime) {
      var el = pane(host, h);
      var c = LC.createChart(el, {
        width: Math.max(320, el.clientWidth || 900), height: h,
        layout: { background: { color: 'transparent' }, textColor: dark ? '#8b9099' : '#718096', fontSize: 11 },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        rightPriceScale: { borderColor: grid, minimumWidth: 64, scaleMargins: showTime === 'main' ? { top: 0.08, bottom: 0.08 } : { top: 0.12, bottom: 0.12 }, autoScale: true },
        timeScale: { borderColor: grid, rightOffset: 4, visible: !!showTime, borderVisible: true },
        crosshair: { mode: 0, vertLine: { labelVisible: !!showTime } },
        handleScroll: { vertTouchDrag: false }
      });
      charts.push(c); panes.push(el);
      return c;
    }

    var top = document.createElement('div'); top.className = 'lyra-tktop'; host.appendChild(top);
    var bar = document.createElement('div'); bar.className = 'lyra-tkrange'; top.appendChild(bar);
    /* 右上角两件悬浮件：分析师评级条 + 说明问号。
       桌面上鼠标移上去展开、移开收起；手机没有 hover，改成点一下展开、点外面收起。 */
    var HOVER = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
    function popup(wrap, card) {
      var t = null;
      var shut = function () {
        [].forEach.call(document.querySelectorAll('.lyra-tkcard.on'), function (c) { c.classList.remove('on'); });
      };
      if (HOVER) {
        wrap.addEventListener('mouseenter', function () { clearTimeout(t); card.classList.add('on'); });
        wrap.addEventListener('mouseleave', function () {
          clearTimeout(t); t = setTimeout(function () { card.classList.remove('on'); }, 140);
        });
        wrap.addEventListener('focusin', function () { card.classList.add('on'); });
        wrap.addEventListener('focusout', function () { card.classList.remove('on'); });
        return;
      }
      wrap.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = card.classList.contains('on');
        shut();
        if (!on) card.classList.add('on');
      });
      if (!window.__lyraTkPopDoc) {
        window.__lyraTkPopDoc = true;
        document.addEventListener('click', shut);
      }
    }

    /* 分析师评级分布条：绿=买入类、灰=持有、红=卖出类，宽度按家数占比 */
    var acts = document.createElement('div'); acts.className = 'lyra-tkacts'; top.appendChild(acts);
    var rw = document.createElement('div'); rw.className = 'lyra-tkpop';
    rw.style.display = 'none'; acts.appendChild(rw);
    var pill = document.createElement('div'); pill.className = 'lyra-tkpill';
    pill.setAttribute('role', 'button'); pill.setAttribute('tabindex', '0');
    pill.setAttribute('aria-label', '分析师评级'); rw.appendChild(pill);
    var rcard = document.createElement('div'); rcard.className = 'lyra-tkcard'; rw.appendChild(rcard);
    popup(rw, rcard);

    var lastClose = close.length ? close[close.length - 1] : null;
    function paintRate() {
      var a = analystOf(sym);
      if (!a) { rw.style.display = 'none'; return; }
      rw.style.display = '';
      var tot = Math.max(1, (a.buy || 0) + (a.hold || 0) + (a.sell || 0));
      var pc = function (v) { return (100 * (v || 0) / tot).toFixed(2) + '%'; };
      var seg = function (v, color, name) {
        if (!v) return '';
        return '<i style="flex:0 0 ' + pc(v) + ';min-width:3px;background:' + color + '" title="' +
          name + ' ' + v + ' 家 · ' + pc(v) + '"></i>';
      };
      var up = (a.mean != null && lastClose) ? (a.mean / lastClose - 1) * 100 : null;
      pill.innerHTML = '<span class="lyra-tkrb">' +
        seg(a.buy, '#48bb78', '买入') + seg(a.hold, '#a0aec0', '持有') + seg(a.sell, '#e53e3e', '卖出') +
        '</span>' +
        (up == null ? '' : '<span class="lyra-tkrp">' + (up >= 0 ? '+' : '') + up.toFixed(0) + '%</span>');
      var px = function (v) { return v == null ? '—' : '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2)); };
      var row = function (k, v) { return '<tr><td class="k">' + k + '</td><td class="r">' + v + '</td></tr>'; };
      var tgt = underlyingOf(sym) || sym;
      rcard.innerHTML =
        '<div class="hd">分析师评级 · ' + tgt + ' · ' + a.n + ' 家</div>' +
        '<table class="lyra-tkct">' +
        row('<span class="sw" style="background:#48bb78"></span>买入', (a.buy || 0) + ' 家　' + pc(a.buy)) +
        row('<span class="sw" style="background:#a0aec0"></span>持有', (a.hold || 0) + ' 家　' + pc(a.hold)) +
        row('<span class="sw" style="background:#e53e3e"></span>卖出', (a.sell || 0) + ' 家　' + pc(a.sell)) +
        '</table>' +
        '<table class="lyra-tkct">' +
        row('12 个月目标价', px(a.low) + ' / <b>' + px(a.mean) + '</b> / ' + px(a.high)) +
        (up == null ? '' : row('较最新收盘 ' + px(lastClose),
          '<b style="color:' + (up >= 0 ? '#2f855a' : '#c53030') + '">' + (up >= 0 ? '+' : '') + up.toFixed(1) + '%</b>')) +
        '</table>' +
        '<div class="src">' + (a.src || '来源未知') + (a.asof ? ' · ' + a.asof : '') +
        '　评级与目标价是卖方的一致预期，只作参照，不参与卡片里的信号判定。</div>';
    }
    paintRate();
    askMeta([sym, underlyingOf(sym)]);
    if (host.__lyraOnMeta) document.removeEventListener('lyra-meta', host.__lyraOnMeta);
    host.__lyraOnMeta = paintRate;
    document.addEventListener('lyra-meta', paintRate);

    var qb = document.createElement('button');
    qb.className = 'lyra-tkhelp'; qb.type = 'button'; qb.textContent = '?';
    qb.title = '「将要启动」是什么意思';
    var qw = document.createElement('div'); qw.className = 'lyra-tkpop'; acts.appendChild(qw);
    qw.appendChild(qb);
    var exp = document.createElement('div'); exp.className = 'lyra-tkcard lyra-tkexp';
    exp.innerHTML =
      '<p><span class="dot"></span><b>将要启动</b>（原来叫「形态二」，见 ' +
      '<a href="/posts/dual-pattern-screen-latest/" target="_blank" rel="noopener">《两形态筛选》</a>）：' +
      'KDJ 三线一起收在 50 中轴带（40~60）里、J &gt; K &gt; D，同时 DIF &gt; DEA &gt; 0。' +
      '意思是动能刚要起来。</p>' +
      '<p><b>它不是买点。</b>70 只标的 10 年实测（买入 = 当天收盘，卖出 = 下一个强势区收尾那天，中途不止损）：' +
      '标记出现后均值 <b>+11.8%</b>、中位 +6.1%、胜率 75%（167 次）——低于「强势区外随便挑一天买」的 +15.3%，' +
      '更低于补票位·超卖的 +21.5% 和建仓区的 +17.7%。叠加到这些位置上也不加分。</p>' +
      '<p>所以它只回答「快要动了吗」，参考价值不如卡片里的其它买入信号。它唯一的长处是等得短：' +
      '中位 48 个交易日就等到强势区收尾，建仓区要 73 天。</p>';
    qw.appendChild(exp);
    popup(qw, exp);
    var read = document.createElement('div'); read.className = 'lyra-tkread';
    if (!(lead && lead.map)) host.appendChild(read);   // 有杠杆时挪到正股标题下面

    /* lead = {sym, map:{日期:[o,h,l,c]}}：把杠杆 ETF 的 K 线叠在最上面一格，
       信号、区间、标注全部仍按正股算。 */
    var c0 = null, cand0 = null, lead0 = [], read0 = null;
    if (lead && lead.map) {
      read0 = document.createElement('div'); read0.className = 'lyra-tkread'; host.appendChild(read0);
      c0 = mkChart(200, false);   // K 线与色带等区间算好之后再画，保证色带在下层
    }
    if (lead && lead.map) {
      var t1 = document.createElement('div'); t1.className = 'lyra-tktitle';
      t1.innerHTML = '<b>' + sym + '</b>' + (labelOf(sym) ? ' <span>' + labelOf(sym) + '</span>' : '');
      host.appendChild(t1);
      host.appendChild(read);
    }
    var zoneLg = DAILY ? [
      ['将要启动', '#d69e2e', false, 'dot'],
      ['回调建仓区', 'rgba(43,108,176,.55)', false, 'band'],
      ['RSI ≤ 30 超卖区', 'rgba(56,161,105,.55)', false, 'band'],
      ['强势区 RSI≥70 起 · ≥65 续', 'rgba(214,158,46,.65)', false, 'band']] : [];
    var lg1 = legend(host, [['MA5', '#e53e3e'], ['MA60', '#3182ce'], ['MA120', '#d69e2e'], ['MA200', '#38a169'],
      ['金叉', '#2f855a', false, 'dot'], ['死叉', '#c53030', false, 'dot']].concat(zoneLg));
    var lgB = legend(host, [['BOLL 中轨 20', '#805ad5'], ['上轨 +2σ', '#3182ce'], ['下轨 −2σ', '#3182ce'],
      ['金叉', '#2f855a', false, 'dot'], ['死叉', '#c53030', false, 'dot']].concat(zoneLg));
    var MAIN = c0 ? 1 : 0;

    var c1 = mkChart(282, 'main');
    // 先画区间带，K 线才会盖在上层。零散的靠合并窗口并进大段，不做长度过滤。
    /* 三种区间的划定在 /zones.js 的 bands()：画图与 analyze()、MCP 共用同一份，
       口径（强势区的滞回与两个终止条件、超卖区的屏障合并、建仓区起点收缩到金叉）
       连同依据都写在那边，这里不要再复制一份。
       hiDark 是事后回顾标记，只有画图用得上。 */
    var B = LZ().bands(dates, rs, xs, ma20, ma200, close);
    var zHigh = B.zHigh, hiDark = B.hiDark, zLow = B.zLow, zPull = B.zPull;
    if (!DAILY) { zHigh = []; hiDark = []; zLow = []; zPull = []; }   // 区间只按日线，聚合视图不画
    bandSeries(c1, dates, zPull, 'rgba(49,130,206,.13)', 'rgba(43,108,176,.5)');
    bandSeries(c1, dates, zLow, 'rgba(56,161,105,.20)', 'rgba(47,133,90,.55)');
    bandSeries(c1, dates, zHigh, 'rgba(214,158,46,.17)', null, zHigh.map(function () { return null; }));
    // 回顾标记单独画一层：它可能落在色带里面，也可能落在色带结束之后
    bandSeries(c1, dates, hiDark.map(function (k) { return [k, k]; }),
               'rgba(183,121,31,.5)', null, hiDark.map(function () { return null; }));
    if (c0) {
      /* 杠杆面板：同一套区间与交叉，日期一一对应，只是 K 线换成杠杆那只。
         杠杆 ETF 上市晚于正股，它没有数据的那一段不画标记，否则全挤在最左边。 */
      var lead1 = 0;
      while (lead1 < dates.length && !lead.map[dates[lead1]]) lead1++;
      var clip = function (zs) {
        return zs.map(function (z) { return [Math.max(z[0], lead1), z[1]]; })
                 .filter(function (z) { return z[1] >= lead1 && z[0] <= z[1]; });
      };
      bandSeries(c0, dates, clip(zPull), 'rgba(49,130,206,.13)', 'rgba(43,108,176,.5)');
      bandSeries(c0, dates, clip(zLow), 'rgba(56,161,105,.20)', 'rgba(47,133,90,.55)');
      bandSeries(c0, dates, clip(zHigh), 'rgba(214,158,46,.17)', null, clip(zHigh).map(function () { return null; }));
      bandSeries(c0, dates, hiDark.filter(function (k) { return k >= lead1; }).map(function (k) { return [k, k]; }),
                 'rgba(183,121,31,.5)', null, hiDark.filter(function (k) { return k >= lead1; }).map(function () { return null; }));
      cand0 = c0.addCandlestickSeries({
        upColor: 'rgba(128,90,213,.5)', downColor: 'rgba(197,48,48,.5)',
        borderUpColor: 'rgba(128,90,213,.75)', borderDownColor: 'rgba(197,48,48,.75)',
        wickUpColor: 'rgba(128,90,213,.55)', wickDownColor: 'rgba(197,48,48,.55)',
        priceLineVisible: false
      });
      cand0.setData(dates.map(function (d) {
        var r0 = lead.map[d];
        return r0 ? { time: d, open: r0[0], high: r0[1], low: r0[2], close: r0[3] } : { time: d };
      }));
      lead0 = dates.map(function (d) { return lead.map[d] ? lead.map[d][3] : null; });
      cand0.setMarkers(xs.filter(function (x) { return x.i >= lead1; }).map(function (x) {
        return {
          time: x.date, position: x.kind === 'golden' ? 'belowBar' : 'aboveBar',
          color: x.kind === 'golden' ? '#2f855a' : '#c53030', shape: 'circle', size: 0.9
        };
      }));
      anchors[0] = { s: cand0, v: lead0 };
    }

    var candle = c1.addCandlestickSeries({
      upColor: 'rgba(56,161,105,.5)', downColor: 'rgba(229,62,62,.5)',
      borderUpColor: 'rgba(56,161,105,.7)', borderDownColor: 'rgba(229,62,62,.7)',
      wickUpColor: 'rgba(56,161,105,.5)', wickDownColor: 'rgba(229,62,62,.5)',
      priceLineVisible: false
    });
    candle.setData(rows.map(function (r) { return { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }; }));

    /* 订单标记：图上只画一个小圆圈，里面写 B 或 S，明细放在鼠标提示里。
       同一天同方向的多笔合并成一个（按股数加权算价），
       日期不是交易日就吸附到之后最近的一根 K 线上。 */
    var ordMarks = [];
    function drawOrders(ser, s5, paneEl, chart, loAt, hiAt) {
      if (!ser || !paneEl) return;
      var os = ordersOf(s5);
      if (!os.length) return;
      var agg = {};
      os.forEach(function (o) {
        var i5 = idx[o.date];
        if (i5 == null) {
          for (var k5 = 0; k5 < dates.length; k5++) if (dates[k5] >= o.date) { i5 = k5; break; }
        }
        if (i5 == null) return;
        var side = o.side === 'sell' ? 'sell' : 'buy', key = i5 + '|' + side;
        var a5 = agg[key] || (agg[key] = { i: i5, side: side, qty: 0, amt: 0 });
        a5.qty += +o.qty; a5.amt += (+o.qty) * (+o.price);
      });
      var olay = document.createElement('div'); olay.className = 'lyra-zlay';
      paneEl.appendChild(olay);
      Object.keys(agg).map(function (k5) { return agg[k5]; })
        .sort(function (a5, b5) { return a5.i - b5.i; })
        .forEach(function (a5) {
          var buy = a5.side === 'buy';
          var el5 = document.createElement('div');
          el5.className = 'lyra-ordm ' + (buy ? 'b' : 's');
          el5.textContent = buy ? 'B' : 'S';
          el5.title = (buy ? '买入 ' : '卖出 ') + dates[a5.i] + '　' +
            (Math.round(a5.qty * 100) / 100) + ' 股 @ ' + (a5.amt / a5.qty).toFixed(2);
          olay.appendChild(el5);
          ordMarks.push({ el: el5, i: a5.i, buy: buy, ser: ser, chart: chart,
                          pane: paneEl, lo: loAt, hi: hiAt });
        });
      var pp = posCalc(os);
      if (pp.qty > 0 && pp.avg) {
        ser.createPriceLine({
          price: pp.avg, color: '#805ad5', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: '均价'
        });
      }
    }
    function placeOrders() {
      ordMarks.forEach(function (m) {
        var x = m.chart.timeScale().timeToCoordinate(dates[m.i]);
        var pv = m.buy ? m.lo(m.i) : m.hi(m.i);
        var y = (pv == null) ? null : m.ser.priceToCoordinate(pv);
        var pw = m.pane.clientWidth, ph = m.pane.clientHeight;
        if (x == null || y == null || x < 8 || x > pw - 8) { m.el.style.display = 'none'; return; }
        var yy = m.buy ? y + 15 : y - 15;
        yy = Math.max(10, Math.min(ph - 10, yy));
        m.el.style.display = ''; m.el.style.left = x + 'px'; m.el.style.top = yy + 'px';
      });
    }
    var maLines = [
      line(c1, '#e53e3e', 2), line(c1, '#3182ce', 3), line(c1, '#d69e2e', 3), line(c1, '#38a169', 4)];
    maLines[0].setData(pack(dates, ma5)); maLines[1].setData(pack(dates, ma60));
    maLines[2].setData(pack(dates, ma120)); maLines[3].setData(pack(dates, ma200));
    var bb = boll(close, 20, 2);
    var bbLines = [line(c1, '#805ad5', 2), line(c1, '#3182ce', 1), line(c1, '#3182ce', 1)];
    bbLines[0].setData(pack(dates, bb.mid)); bbLines[1].setData(pack(dates, bb.up)); bbLines[2].setData(pack(dates, bb.lo));
    function applyMain(mode) {
      var isB = mode === 'boll';
      maLines.forEach(function (l2) { l2.applyOptions({ visible: !isB }); });
      bbLines.forEach(function (l2) { l2.applyOptions({ visible: isB }); });
      lg1.box.style.display = isB ? 'none' : '';
      lgB.box.style.display = isB ? '' : 'none';
      try { localStorage.setItem(MAINK, isB ? 'boll' : 'ma'); } catch (e) {}
    }
    candle.setMarkers(xs.map(function (x) {
      return {
        time: x.date, position: x.kind === 'golden' ? 'belowBar' : 'aboveBar',
        color: x.kind === 'golden' ? '#2f855a' : '#c53030', shape: 'circle', size: 0.9
      };
    }));
    anchors[MAIN] = { s: candle, v: close };

    var lg2 = legend(host, [['DIF', '#3182ce'], ['DEA', '#d69e2e'], ['MACD 柱', '#a0aec0']]);
    var c2 = mkChart(104, false);
    c2.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })
      .setData(pack(dates, m.bar).map(function (d) { return { time: d.time, value: d.value, color: d.value >= 0 ? '#9ae6b4' : '#feb2b2' }; }));
    var difS = line(c2, '#3182ce', 2); difS.setData(pack(dates, m.dif));
    line(c2, '#d69e2e', 2).setData(pack(dates, m.dea));
    anchors[MAIN + 1] = { s: difS, v: m.dif };

    var lg3 = legend(host, [['K', '#3182ce'], ['D', '#d69e2e'], ['J', '#805ad5']]);
    var c3 = mkChart(104, false);
    var kS = line(c3, '#3182ce', 2); kS.setData(pack(dates, kd.K));
    line(c3, '#d69e2e', 2).setData(pack(dates, kd.D));
    line(c3, '#805ad5', 1).setData(pack(dates, kd.J));
    anchors[MAIN + 2] = { s: kS, v: kd.K };

    var lg4 = legend(host, [['RSI14', '#805ad5'], ['30 / 70', '#cbd5e0', false]]);
    var c4 = mkChart(132, 'axis');
    var rl = line(c4, '#805ad5', 2); rl.setData(pack(dates, rs));
    rl.createPriceLine({ price: 70, color: '#cbd5e0', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
    rl.createPriceLine({ price: 30, color: '#cbd5e0', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
    anchors[MAIN + 3] = { s: rl, v: rs };

    /* ── 区间标注 ──────────────────────────────────────────────
       买入区（绿/蓝）：按每天等额买入算均价（等权），以及按金叉死叉加权后的均价。
       金额是按天投的，所以均价 = 总投入 ÷ 总股数 = Σw ÷ Σ(w/价)，不是价格的算术平均。
       强势区（琥珀）：区间涨幅、最高最低范围、最后一根的卖价，
       以及从「自上次清仓以来累计买入的持仓成本」到这次卖价的涨幅。 */
    var xsG = {}, xsD = {};
    xs.forEach(function (x) { (x.kind === 'golden' ? xsG : xsD)[x.i] = true; });
    var wOf = function (i, kind) {
      if (kind === 'b') return xsG[i] ? 2 : (xsD[i] ? 0.5 : 1);
      return xsG[i] ? 20 : (xsD[i] ? 5 : 10);
    };
    var zoneList = []
      .concat(zLow.map(function (z) { return { z: z, k: 'g' }; }))
      .concat(zPull.map(function (z) { return { z: z, k: 'b' }; }))
      .concat(zHigh.map(function (z) { return { z: z, k: 'a' }; }));
    zoneList.sort(function (p1, p2) { return p1.z[0] - p2.z[0]; });

    var spent = 0, shares = 0;
    zoneList.forEach(function (o) {
      var a = o.z[0], b = o.z[1], i;
      if (o.k === 'a') {
        var hi = -Infinity, lo = Infinity;
        for (i = a; i <= b; i++) { if (high[i] > hi) hi = high[i]; if (low[i] < lo) lo = low[i]; }
        o.hi = hi; o.lo = lo; o.sell = close[b];
        o.chg = (close[b] / close[a] - 1) * 100;
        o.cost = shares > 0 ? spent / shares : null;
        o.gain = o.cost ? (close[b] / o.cost - 1) * 100 : null;
        spent = 0; shares = 0;                    // 清仓
      } else {
        var sw = 0, swp = 0, n1 = 0, np = 0;
        for (i = a; i <= b; i++) {
          var w = wOf(i, o.k);
          sw += w; swp += w / close[i]; n1 += 1; np += 1 / close[i];
        }
        o.avg = n1 / np;                          // 每天等额
        o.wavg = sw / swp;                        // 按金叉死叉加权
        o.w = sw;
        spent += sw; shares += swp;
      }
    });

    // 图内：买入区画均价线，强势区画高低范围线
    /* 每个区间单独一条线段。不能用一条 series 加 whitespace——
       lightweight-charts 在 whitespace 处不会断线，会把相邻区间连成斜线。 */
    function segSeries(list, pick, color, style, w) {
      list.slice(-40).forEach(function (o) {
        var v = pick(o);
        if (v == null || !isFinite(v)) return;
        var se = c1.addLineSeries({
          color: color, lineWidth: w || 1, lineStyle: style || 0,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          autoscaleInfoProvider: function () { return null; }
        });
        var pts = [];
        for (var k = o.z[0]; k <= o.z[1]; k++) pts.push({ time: dates[k], value: v });
        if (pts.length === 1) pts.push({ time: dates[Math.min(o.z[1] + 1, dates.length - 1)], value: v });
        se.setData(pts);
      });
    }
    var zg = zoneList.filter(function (o) { return o.k === 'g'; });
    var zb = zoneList.filter(function (o) { return o.k === 'b'; });
    var za = zoneList.filter(function (o) { return o.k === 'a'; });
    segSeries(zg, function (o) { return o.avg; }, 'rgba(47,133,90,.45)', 2, 1);
    segSeries(zg, function (o) { return o.wavg; }, '#2f855a', 0, 2);
    segSeries(zb, function (o) { return o.avg; }, 'rgba(43,108,176,.45)', 2, 1);
    segSeries(zb, function (o) { return o.wavg; }, '#2b6cb0', 0, 2);
    segSeries(za, function (o) { return o.hi; }, 'rgba(183,121,31,.45)', 2, 1);
    segSeries(za, function (o) { return o.lo; }, 'rgba(183,121,31,.45)', 2, 1);

    /* 图内浮层标签：用 timeToCoordinate / priceToCoordinate 把 DOM 贴到对应位置，
       随缩放平移实时跟着走；区间在屏幕上太窄就不显示，免得糊成一团。 */
    /* 「将要启动」（即「两形态筛选」一文里的形态二）：KDJ 三线聚拢在 40~60 中轴带、J > K > D，
       同时 DIF > DEA > 0。三个条件全中的那根 K 线下方打一个琥珀色圆点。
       实测它不是买点，只说明动能快要起来了，说明写在面板右上角的问号里。 */
    var p2 = [];
    for (var q2 = 0; q2 < dates.length; q2++) {
      var K2 = kd.K[q2], D2 = kd.D[q2], J2 = kd.J[q2], f2a = m.dif[q2], f2b = m.dea[q2];
      if (K2 == null || D2 == null || J2 == null) continue;
      if (K2 < 40 || K2 > 60 || D2 < 40 || D2 > 60 || J2 < 40 || J2 > 60) continue;
      if (!(J2 > K2 && K2 > D2)) continue;
      if (!(f2b > 0 && f2a > f2b)) continue;
      p2.push(q2);
    }

    var lay = document.createElement('div'); lay.className = 'lyra-zlay';
    panes[MAIN].appendChild(lay);
    var labs = zoneList.map(function (o) {
      var el = document.createElement('div');
      el.className = 'lyra-zlab ' + o.k;
      var f2 = function (v) { return (v == null || !isFinite(v)) ? '—' : v.toFixed(2); };
      var pc = function (v) { return (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; };
      var days = o.z[1] - o.z[0] + 1, mid, lo2, hi2, i2;
      lo2 = Infinity; hi2 = -Infinity;
      for (i2 = o.z[0]; i2 <= o.z[1]; i2++) { if (high[i2] > hi2) hi2 = high[i2]; if (low[i2] < lo2) lo2 = low[i2]; }
      o.plo = lo2; o.phi = hi2;
      mid = (lo2 + hi2) / 2;
      // 第二行三种区间统一格式：振幅 · 低~高 · 天数 · 中值
      var amp = (lo2 > 0) ? (hi2 / lo2 - 1) * 100 : null;
      var sub = '<span class="sub">' + pc(amp) + ' · ' + f2(lo2) + '~' + f2(hi2) +
        ' · ' + days + '日 · 中 ' + f2(mid) + '</span>';
      if (o.k === 'a') {
        el.innerHTML = '首末 <b>' + pc(o.chg) + '</b>' +
          (o.gain == null ? '' : ' · 自成本 <b>' + pc(o.gain) + '</b>') +
          ' · 卖 ' + f2(o.sell) + sub;
      } else {
        el.innerHTML = '权 <b>' + f2(o.wavg) + '</b> · 均 ' + f2(o.avg) + sub;
      }
      lay.appendChild(el);
      return { o: o, el: el };
    });

    /* 杠杆那一格也标上数据：区间还是正股划出来的那几段，
       但涨跌幅、均价、高低范围全部换成杠杆 ETF 自己的价格——
       同一段行情里正股走多少、杠杆走多少，摆在一起就看出放大倍数了。 */
    var labs0 = [];
    if (c0 && lead && lead.map) {
      var lay0 = document.createElement('div'); lay0.className = 'lyra-zlay';
      panes[0].appendChild(lay0);
      var lH = [], lL = [], lC = [];
      dates.forEach(function (d, i3) {
        var r3 = lead.map[d];
        lH[i3] = r3 ? r3[1] : null; lL[i3] = r3 ? r3[2] : null; lC[i3] = r3 ? r3[3] : null;
      });
      var f2b = function (v) { return (v == null || !isFinite(v)) ? '—' : v.toFixed(2); };
      var pcb = function (v) { return (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; };
      var spent0 = 0, shares0 = 0;
      zoneList.forEach(function (o) {
        var av = [], i4;
        for (i4 = o.z[0]; i4 <= o.z[1]; i4++) if (lC[i4] != null) av.push(i4);
        if (av.length < 2) return;                      // 杠杆 ETF 上市晚，覆盖不到的区间不标
        var a4 = av[0], b4 = av[av.length - 1];
        var hi4 = -Infinity, lo4 = Infinity;
        av.forEach(function (i5) {
          if (lH[i5] > hi4) hi4 = lH[i5];
          if (lL[i5] < lo4) lo4 = lL[i5];
        });
        var days4 = av.length;
        var amp4 = (lo4 > 0) ? (hi4 / lo4 - 1) * 100 : null;
        var sub4 = '<span class="sub">' + pcb(amp4) + ' · ' + f2b(lo4) + '~' + f2b(hi4) +
          ' · ' + days4 + '日 · 中 ' + f2b((lo4 + hi4) / 2) + '</span>';
        var el4 = document.createElement('div');
        el4.className = 'lyra-zlab ' + o.k;
        if (o.k === 'a') {
          var chg4 = (lC[b4] / lC[a4] - 1) * 100;
          var cost4 = shares0 > 0 ? spent0 / shares0 : null;
          var gain4 = cost4 ? (lC[b4] / cost4 - 1) * 100 : null;
          el4.innerHTML = '首末 <b>' + pcb(chg4) + '</b>' +
            (gain4 == null ? '' : ' · 自成本 <b>' + pcb(gain4) + '</b>') +
            ' · 卖 ' + f2b(lC[b4]) + sub4;
          spent0 = 0; shares0 = 0;
        } else {
          var sw4 = 0, swp4 = 0, n4 = 0, np4 = 0;
          av.forEach(function (i5) {
            var w4 = wOf(i5, o.k);
            sw4 += w4; swp4 += w4 / lC[i5]; n4 += 1; np4 += 1 / lC[i5];
          });
          el4.innerHTML = '权 <b>' + f2b(sw4 / swp4) + '</b> · 均 ' + f2b(n4 / np4) + sub4;
          spent0 += sw4; shares0 += swp4;
        }
        lay0.appendChild(el4);
        labs0.push({ o: { z: [a4, b4], phi: hi4, plo: lo4 }, el: el4 });
      });
    }
    /* 标签优先贴上下边缘、离 K 线越远越好；放不下才一格一格往中间让，
       仍然压到 K 线或和别的标签打架就换另一边，都不行就不画。 */
    if (!DAILY) p2 = [];
    var p2els = p2.map(function (i2) {
      var el = document.createElement('div');
      el.className = 'lyra-p2';
      el.title = '将要启动（原形态二）：KDJ 三线在 50 中轴聚拢 + MACD 零轴上方多头（' + dates[i2] + '）';
      lay.appendChild(el);
      return { i: i2, el: el };
    });
    function placeP2() {
      var ts = c1.timeScale(), pw = panes[MAIN].clientWidth, ph = panes[MAIN].clientHeight;
      p2els.forEach(function (o) {
        var x = ts.timeToCoordinate(dates[o.i]);
        var y = candle.priceToCoordinate(low[o.i]);
        if (x == null || y == null || x < 0 || x > pw) { o.el.style.display = 'none'; return; }
        var yy = y + 11;
        if (yy > ph - 30) { o.el.style.display = 'none'; return; }
        o.el.style.display = ''; o.el.style.left = x + 'px'; o.el.style.top = yy + 'px';
      });
    }
    /* AXIS = 底部日期轴的高度，标签不能压到它上面；杠杆格没有日期轴所以传 0 */
    function placeSet(chart, paneEl, ser, list, AXIS) {
      var ts = chart.timeScale(), pw = paneEl.clientWidth,
          ph = paneEl.clientHeight - AXIS;
      var placed = [], items = [];
      list.forEach(function (L) {
        var x1 = ts.timeToCoordinate(dates[L.o.z[0]]);
        var x2 = ts.timeToCoordinate(dates[L.o.z[1]]);
        var vx1 = Math.max(x1 == null ? 0 : x1, 0), vx2 = Math.min(x2 == null ? pw : x2, pw);
        var yHi = ser.priceToCoordinate(L.o.phi), yLo = ser.priceToCoordinate(L.o.plo);
        if (x1 == null || x2 == null || yHi == null || yLo == null || (vx2 - vx1) < 24) {
          L.el.style.display = 'none'; return;
        }
        L.el.style.display = '';
        items.push({ L: L, cx: (vx1 + vx2) / 2, yHi: yHi, yLo: yLo });
      });
      items.sort(function (m, n) { return m.cx - n.cx; });
      items.forEach(function (it) {
        var el = it.L.el, w = el.offsetWidth, h = el.offsetHeight;
        var cx = Math.min(Math.max(it.cx, w / 2 + 3), pw - w / 2 - 3);
        // top 是标签下沿（transform 为 translate(-50%,-100%)）
        var cand = [], g;
        var top0 = [], bot0 = [];
        for (g = 0; g < 10; g++) {
          top0.push({ t: 3 + h + g * (h + 4), e: 't' });
          bot0.push({ t: ph - 3 - g * (h + 4), e: 'b' });
        }
        // 哪边离 K 线远就先试哪边
        cand = (it.yHi >= ph - it.yLo) ? top0.concat(bot0) : bot0.concat(top0);
        var pick = null;
        for (g = 0; g < cand.length; g++) {
          var t = cand[g].t;
          if (t - h < 3 || t > ph - 3) continue;
          if (cand[g].e === 't' && t > it.yHi - 4) continue;      // 顶部标签不能压到最高价上
          if (cand[g].e === 'b' && (t - h) < it.yLo + 4) continue; // 底部标签不能压到最低价上
          var hit = false;
          for (var j = 0; j < placed.length; j++) {
            var q = placed[j];
            if (Math.abs(cx - q.cx) < (w + q.w) / 2 + 4 && Math.abs(t - q.top) < Math.max(h, q.h) + 3) { hit = true; break; }
          }
          if (!hit) { pick = t; break; }
        }
        if (pick == null) { el.style.display = 'none'; return; }
        el.style.left = cx + 'px';
        el.style.top = pick + 'px';
        placed.push({ cx: cx, top: pick, w: w, h: h });
      });
    }
    drawOrders(candle, sym, panes[MAIN], c1,
      function (i) { return low[i]; }, function (i) { return high[i]; });
    if (cand0 && lead && lead.map) {
      drawOrders(cand0, lead.sym, panes[0], c0,
        function (i) { var r = lead.map[dates[i]]; return r ? r[2] : null; },
        function (i) { var r = lead.map[dates[i]]; return r ? r[1] : null; });
    }
    function placeLabels() {
      placeP2();
      placeOrders();
      placeSet(c1, panes[MAIN], candle, labs, 30);
      if (c0 && cand0 && labs0.length) placeSet(c0, panes[0], cand0, labs0, 0);
    }
    c1.timeScale().subscribeVisibleLogicalRangeChange(placeLabels);
    setTimeout(placeLabels, 0);

    // ── 读数：日期 + OHLC + 各面板指标值 ────────────────────────────
    function show(i) {
      if (i == null || i < 0) i = dates.length - 1;
      if (read0 && lead && lead.map) {
        var r0 = lead.map[dates[i]];
        read0.innerHTML = r0
          ? '<span class="dt">' + dates[i] + '</span>' + lead.sym +
            '　开 <span class="n">' + fmt(r0[0]) + '</span>　高 <span class="n">' + fmt(r0[1]) +
            '</span>　低 <span class="n">' + fmt(r0[2]) + '</span>　收 <span class="n">' + fmt(r0[3]) + '</span>' +
            '　<span class="p ' + (r0[3] >= r0[0] ? 'up' : 'dn') + '">' +
            (((r0[3] / r0[0] - 1) * 100) >= 0 ? '+' : '') + ((r0[3] / r0[0] - 1) * 100).toFixed(2) + '%</span>'
          : '<span class="dt">' + dates[i] + '</span>' + lead.sym + ' 当日无数据';
      }
      var p = i > 0 ? close[i - 1] : close[i];
      var ch = p ? (close[i] / p - 1) * 100 : 0;
      var nb = function (v) { return '<span class="n">' + fmt(v) + '</span>'; };
      var tfNote = DAILY ? '' : ('<span class="sess">' + (TF === 'W' ? '周线' : '月线') +
        (rows[i][6] ? ' · ' + rows[i][6][0] + ' 起 ' + rows[i][6].length + ' 个交易日' : '') +
        (i === dates.length - 1 && periodOpen(dates[i]) ? ' · 进行中' : '') + '</span>');
      read.innerHTML = '<span class="dt">' + dates[i] + '</span>' + tfNote +
        '开 ' + nb(open_[i]) + '　高 ' + nb(high[i]) + '　低 ' + nb(low[i]) + '　收 ' + nb(close[i]) +
        '　<span class="p ' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</span>' +
        '　量 <span class="n">' + (vol[i] ? (vol[i] / 1e6).toFixed(2) + 'M' : '—') + '</span>';
      var set = function (arr, vals, d) { arr.forEach(function (el, k) { el.textContent = fmt(vals[k], d); }); };
      set(lg1, [ma5[i], ma60[i], ma120[i], ma200[i]]);
      set(lgB, [bb.mid[i], bb.up[i], bb.lo[i]]);
      set(lg2, [m.dif[i], m.dea[i], m.bar[i]], 3);
      set(lg3, [kd.K[i], kd.D[i], kd.J[i]]);
      set(lg4, [rs[i]]);
    }

    // ── 十字光标贯穿四个面板 ──────────────────────────────────────
    var busy = false, dragging = false;
    panes.forEach(function (pe) {
      pe.addEventListener('pointerdown', function () { dragging = true; });
    });
    var upFn = function () {
      if (!dragging) return;
      dragging = false;
      charts.forEach(function (c) { try { c.clearCrosshairPosition(); } catch (e) {} });
    };
    document.addEventListener('pointerup', upFn);
    document.addEventListener('pointercancel', upFn);
    charts.forEach(function (from) {
      from.subscribeCrosshairMove(function (param) {
        if (busy || dragging) return;   // 拖动中不跟，松手后再重新跟随鼠标
        var live = param && param.point && param.time != null;
        show(live ? idx[param.time] : null);
        busy = true;
        charts.forEach(function (c, j) {
          if (c === from) return;
          if (!live) { c.clearCrosshairPosition(); return; }
          var a = anchors[j], i = idx[param.time];
          var v = (i != null && a.v[i] != null && isFinite(a.v[i])) ? a.v[i] : 0;
          c.setCrosshairPosition(v, param.time, a.s);
        });
        busy = false;
      });
    });

    // ── 缩放/平移联动 ─────────────────────────────────────────────
    var syncing = false;
    charts.forEach(function (a) {
      a.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
        if (syncing || !r) return;
        syncing = true;
        charts.forEach(function (b) { if (b !== a) b.timeScale().setVisibleLogicalRange(r); });
        syncing = false;
      });
    });

    function applyRange(from) {
      charts.forEach(function (c) { c.timeScale().setVisibleLogicalRange({ from: from, to: dates.length + 4 }); });
    }
    var last = dates[dates.length - 1];
    /* 显示区间按日历天数算（不按根数），这样 日/周/月 三种周期下同一个按钮
       看到的是同一段时间；周线的 1M 只有四五根，本来就该这样。 */
    function rangeFrom(v) {
      if (v == null) return 0;
      var since;
      if (v === 'ytd') since = last.slice(0, 4) + '-01-01';
      else { var t = new Date(last + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - v); since = t.toISOString().slice(0, 10); }
      for (var i = 0; i < dates.length; i++) if (dates[i] >= since) return i;
      return Math.max(0, dates.length - 2);
    }
    var pick = initRange === undefined ? 366 : initRange;
    var curRange = pick;
    buildBar(bar, { tf: TF, range: pick, main: mainMode() }, function (key, v) {
      if (key === 'intra') { renderIntra(host, sym, rowsD, leadD, v); return; }
      if (key === 'tf') { if (v !== TF) renderLocal(host, sym, rowsD, leadD, curRange, v); return; }
      if (key === 'range') { curRange = v; applyRange(rangeFrom(v)); return; }
      if (key === 'main') applyMain(v);
    });
    applyRange(rangeFrom(pick));
    applyMain(mainMode());
    show(null);

    // 尺寸自适应：副图高度固定，主图吃掉弹窗里剩下的高度（弹窗关闭后自动摘掉监听）
    var SUB = c0 ? [null, null, 104, 104, 132] : [null, 104, 104, 132];
    function onResize() {
      if (!document.body.contains(host)) { window.removeEventListener('resize', onResize); return; }
      // 容器被内容撑开时（看板页在手机上就是这样）改用的高度上限：视口的 72%。
      // 那种容器不能当尺子——图变高 → 容器变高 → 下次算得更高，手机滚动时
      // 地址栏收放不停触发 resize，于是越看越长。
      var cap = Math.max(260, Math.round((window.innerHeight || 800) * 0.72));
      var used = 0;
      [].forEach.call(host.children, function (el) {
        if (!el.classList.contains('lyra-tkpane') && !el.classList.contains('lyra-xtab')) used += el.offsetHeight;
      });
      var fixed = 0, si;
      for (si = 0; si < SUB.length; si++) if (SUB[si]) fixed += SUB[si];
      var avail = (host.clientHeight || 700) - 28 - used - fixed;
      var hs;
      if (c0) {
        var each = Math.max(150, Math.round(avail / 2));
        hs = [each, each, SUB[2], SUB[3], SUB[4]];
      } else {
        hs = [Math.max(240, Math.round(avail)), SUB[1], SUB[2], SUB[3]];
      }
      function apply() {
        charts.forEach(function (c, i) {
          panes[i].style.height = hs[i] + 'px';
          c.applyOptions({ width: Math.max(320, panes[i].clientWidth || 900), height: hs[i] });
        });
      }
      var before = host.clientHeight;
      apply();
      if (typeof placeLabels === 'function') setTimeout(placeLabels, 0);
      // 容器高度跟着内容一起变（看板页在手机上就是这样）→ 它不能当尺子用。
      // 改成直接按视口给一个固定高度，这样反复触发 resize 结果也不变。
      if (host.clientHeight !== before) {
        var room = Math.max(240, cap - fixed);
        if (c0) { var half = Math.max(150, Math.round(room / 2)); hs[0] = half; hs[1] = half; }
        else hs[0] = room;
        apply();
        if (typeof placeLabels === 'function') setTimeout(placeLabels, 0);
        return;
      }
      // 上面的估算没算外边距，按实际溢出量再修正一次，让四个面板正好占满弹窗
      var padB = parseFloat(getComputedStyle(host).paddingBottom) || 0;
      var last = panes[panes.length - 1];
      var over = last.getBoundingClientRect().bottom + padB - host.getBoundingClientRect().bottom;
      if (Math.abs(over) > 1) {
        if (c0) { var cut = Math.round(over / 2); hs[0] = Math.max(150, hs[0] - cut); hs[1] = Math.max(150, hs[1] - (over - cut)); }
        else hs[0] = Math.max(240, Math.round(hs[0] - over));
        apply();
      }
    }
    if (host.__lyraOnResize) window.removeEventListener('resize', host.__lyraOnResize);
    host.__lyraOnResize = onResize;
    window.addEventListener('resize', onResize);
    onResize();

    var recBtn = document.createElement('button'); recBtn.type = 'button';
    recBtn.className = 'lyra-tkrecb'; recBtn.textContent = '区间与交叉记录';
    var recBody = document.createElement('div'); recBody.className = 'lyra-tkrecbody';
    recBtn.addEventListener('click', function () {
      var on = recBody.classList.toggle('on');
      recBtn.textContent = on ? '收起记录' : '区间与交叉记录';
    });
    host.appendChild(recBtn); host.appendChild(recBody);

    var ztab = document.createElement('div'); ztab.className = 'lyra-xtab';
    var zf = function (v, d2) { return (v == null || !isFinite(v)) ? '—' : v.toFixed(d2 == null ? 2 : d2); };
    var zp = function (v) { return (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; };
    ztab.innerHTML = '<div style="font-size:12px;color:var(--text-muted,#718096);margin-bottom:6px">' +
      '最近 12 个区间（' + sym + '）</div><table><tbody>' +
      zoneList.slice(-12).reverse().map(function (o) {
        var nm = o.k === 'g' ? '超卖区' : o.k === 'b' ? '建仓区' : '强势区';
        var cl = o.k === 'g' ? 'g' : o.k === 'a' ? 'd' : '';
        var mid = ((o.plo + o.phi) / 2);
        var info = (o.k === 'a')
          ? ('首末 ' + zp(o.chg) + '　卖 ' + zf(o.sell) + (o.gain == null ? '' : '　自成本 ' + zp(o.gain)))
          : ('加权 ' + zf(o.wavg) + '　等权 ' + zf(o.avg));
        return '<tr><td>' + dates[o.z[0]] + ' → ' + dates[o.z[1]] + '</td>' +
          '<td class="' + cl + '">' + nm + '</td>' +
          '<td style="text-align:right">' + (o.z[1] - o.z[0] + 1) + ' 日</td>' +
          '<td>' + info + '</td>' +
          '<td style="text-align:right">' + zf(o.plo) + '~' + zf(o.phi) + '　中 ' + zf(mid) + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (DAILY) recBody.appendChild(ztab);

    var tbl = document.createElement('div'); tbl.className = 'lyra-xtab';
    tbl.innerHTML = '<div style="font-size:12px;color:var(--text-muted,#718096);margin-bottom:6px">最近 14 次交叉（均线 / MACD，' + last + '）</div><table><tbody>' +
      xs.slice(-14).reverse().map(function (x) {
        return '<tr><td>' + x.date + '</td><td class="' + (x.kind === 'golden' ? 'g' : 'd') + '">' +
          (x.kind === 'golden' ? '金叉' : '死叉') + '</td><td>' + x.what + '</td><td style="text-align:right">' +
          close[x.i].toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table>';
    recBody.appendChild(tbl);
  }

  function open(sym, bust, mode0) {
    inject();
    var cur = String(sym || '').toUpperCase();
    var back = document.createElement('div'); back.className = 'lyra-tkmodal';
    var box = document.createElement('div'); box.className = 'lyra-tkbox';
    back.appendChild(box); document.body.appendChild(back);
    function close() { back.remove(); document.removeEventListener('keydown', esc); clearUrl(); }
    function esc(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) { if (e.target === back && mode !== 'dock') close(); });
    document.addEventListener('keydown', esc);

    var tvUrl = function (s2) {
      return 'https://www.tradingview.com/chart/?symbol=' + (EX[s2] || 'NASDAQ') + '%3A' + s2;
    };
    /* 把「看哪只 + 什么形态」写进地址栏，刷新页面或把链接发出去都能还原。 */
    function writeUrl() {
      try {
        var h = '#tk=' + encodeURIComponent(cur) + (mode ? ',' + mode : '');
        if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
      } catch (e) { /* 忽略 */ }
    }
    function clearUrl() {
      try {
        if (/^#tk=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      } catch (e) { /* 忽略 */ }
    }

    var head = document.createElement('div'); head.className = 'lyra-tkhead';
    head.innerHTML = '<h3></h3>' +
      '<span class="tools"><a class="ext" target="_blank" rel="noopener">在 TradingView 打开 ↗</a></span>';
    var h3 = head.querySelector('h3'), ext = head.querySelector('.ext');
    var tools = head.querySelector('.tools');

    // 代码输入框（右上角）：本地快照没有的标的会去公开接口现拉
    var inp = document.createElement('input');
    inp.className = 'lyra-tksym'; inp.placeholder = '换个代码'; inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'characters');
    var go = document.createElement('button'); go.className = 'lyra-tkgo'; go.textContent = '查看';
    var submit = function () {
      var v = (inp.value || '').trim().toUpperCase();
      if (!v || !/^\^?[A-Z][A-Z0-9.\-]{0,9}$/.test(v)) { inp.focus(); return; }
      inp.value = ''; show(v);
    };
    go.onclick = submit;
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    tools.insertBefore(inp, tools.firstChild);
    tools.insertBefore(go, tools.firstChild.nextSibling);

    // 全屏 / 固定到右侧栏
    var mode = (mode0 === 'full' || mode0 === 'dock') ? mode0 : '';
    function applyMode() {
      back.className = 'lyra-tkmodal' + (mode ? ' ' + mode : '');
      fs.className = 'lyra-tkicon' + (mode === 'full' ? ' on' : '');
      dk.className = 'lyra-tkicon' + (mode === 'dock' ? ' on' : '');
      writeUrl();
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
    }
    function setMode(m) { mode = (mode === m) ? '' : m; applyMode(); }
    var fs = document.createElement('button');
    fs.className = 'lyra-tkicon'; fs.textContent = '⛶'; fs.title = '全屏';
    fs.onclick = function () { setMode('full'); };
    var dk = document.createElement('button');
    dk.className = 'lyra-tkicon'; dk.textContent = '⇥'; dk.title = '固定到右侧栏';
    dk.onclick = function () { setMode('dock'); };
    var rf = document.createElement('button');
    rf.className = 'lyra-tkrefresh'; rf.textContent = '↻';
    rf.title = '重新拉取组件与行情（不用刷新整页）';
    rf.onclick = function () { rf.className = 'lyra-tkrefresh busy'; reload(cur); };
    var btn = document.createElement('button'); btn.className = 'lyra-tkclose'; btn.textContent = '×';
    btn.onclick = close;
    tools.appendChild(fs); tools.appendChild(dk); tools.appendChild(rf); tools.appendChild(btn);

    /* 刷新：把脚本自己重新拉一遍并就地执行，再用新代码重开当前标的。 */
    function reload(s2) {
      var keep = mode;
      var reopen = function () {
        back.remove(); document.removeEventListener('keydown', esc);   // 不清 URL，形态要留着
        var fn = (window.LyraTicker && window.LyraTicker.open) || open;
        fn(s2, true, keep);
      };
      if (!SELF) return reopen();
      fetch(SELF.split('?')[0] + '?t=' + Date.now(), { cache: 'reload' })
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (code) {
          if (code) { try { (0, eval)(code); } catch (e) { /* 新代码有问题就继续用旧的 */ } }
          reopen();
        })
        .catch(reopen);
    }
    box.appendChild(head);

    var body = document.createElement('div'); body.className = 'lyra-tkbody';
    box.appendChild(body);

    function loading(msg) {
      body.innerHTML = '<div class="lyra-tkload">' + msg +
        '<div class="lyra-tkbar"><i></i></div></div>';
    }
    /* 快照与接口一起取，接口那份负责把快照之后的收盘补上去。 */
    function fetchRows(s2, cb) {
      fetchSeries(s2, bust).then(function (rows) {
        if (rows && rows.length) cb(rows);
        else cb(null, '取不到数据');
      });
    }
    function show(s2) {
      cur = s2;
      writeUrl();
      h3.textContent = s2 + (NAMES[s2] ? ' · ' + NAMES[s2] : '');
      ext.href = tvUrl(s2);
      loading('加载中…');
      loadLib(function (err) {
        if (err) { body.innerHTML = '<div class="lyra-tkerr">图表库加载失败。</div>'; return; }
        fetchRows(s2, function (rows, msg) {
          if (cur !== s2) return;                     // 期间又换了代码，丢弃这次结果
          if (rows && rows.length >= MIN_BARS) { renderLocal(body, s2, rows); return; }
          body.innerHTML = '<div class="lyra-tkerr">拿不到 ' + s2 + ' 的行情' +
            (msg ? '（' + msg + '）' : '') + '。<br>' +
            '<a class="ext" target="_blank" rel="noopener" href="' + tvUrl(s2) + '">在 TradingView 打开 ↗</a></div>';
        });
      });
    }
    applyMode();
    show(cur);
  }

  // 组件可能被刷新按钮重新执行一次，先摘掉上一版的监听，否则会弹出两个窗口
  if (window.__lyraTkClick) document.removeEventListener('click', window.__lyraTkClick);
  window.__lyraTkClick = function (e) {
    var a = e.target.closest ? e.target.closest('a.tk') : null;
    if (!a) return;
    e.preventDefault();
    open(a.dataset.sym || a.textContent.trim());
  };
  document.addEventListener('click', window.__lyraTkClick);

  // 地址栏里带 #tk=SYM[,dock|full] 就自动打开；只在首次加载时做一次
  if (!window.__lyraTkBooted) {
    window.__lyraTkBooted = true;
    (function () {
      var m = /^#tk=(%5E|\^)?([A-Za-z0-9.\-]{1,10})(?:,(dock|full))?$/.exec(location.hash || '');
      if (m) setTimeout(function () { open(((m[1] ? '^' : '') + m[2]).toUpperCase(), false, m[3] || ''); }, 0);
    })();
  }

  /* 给「股市看板」用的算法出口：只算不画，返回区间、交叉和今日状态。
     和 renderLocal 用的是同一批工具函数（sma/ema/rsi/crosses/flagZones/rsiZones），
     口径与弹窗里的图一致。 */
  /* 看板用的当日结论：区间/等待/交叉/将要启动。实现在 /zones.js。 */
  function analyze(rows) { return LZ().analyze(rows); }

  /* 把图直接画进页面里的某个容器（股市看板页用），不走弹窗。
     host 需要有确定的高度，组件会按它的剩余空间分配四个面板。 */
  function mount(host, sym, cb) {
    inject();
    var s2 = String(sym || '').toUpperCase();
    host.innerHTML = '<div class="lyra-tkload">加载中…<div class="lyra-tkbar"><i></i></div></div>';
    loadLib(function (err) {
      if (err) { host.innerHTML = '<div class="lyra-tkerr">图表库加载失败。</div>'; if (cb) cb(err); return; }
      var base = underlyingOf(s2);
      var done = function (rows, lead) {
        if (!rows || rows.length < MIN_BARS) {
          host.innerHTML = '<div class="lyra-tkerr">拿不到 ' + (base || s2) + ' 的行情。</div>';
          if (cb) cb(new Error('no data')); return;
        }
        renderLocal(host, base || s2, rows, lead);
        if (cb) cb(null);
      };
      if (base) {
        // 杠杆 ETF：正股算信号，杠杆那只叠在上面看走势
        host.innerHTML = '<div class="lyra-tkload">正在拉取 ' + s2 + ' 与 ' + base +
          ' 的行情…<div class="lyra-tkbar"><i></i></div></div>';
        Promise.all([fetchSeries(base), fetchSeries(s2)]).then(function (a) {
          var mp = {};
          (a[1] || []).forEach(function (r) { mp[r[0]] = [r[1], r[2], r[3], r[4]]; });
          done(a[0], { sym: s2, map: mp });
        }).catch(function () { done(null); });
        return;
      }
      fetchSeries(s2).then(done).catch(function () { done(null); });
    });
  }

  window.LyraTicker = { open: open, mount: mount, underlyingOf: underlyingOf, labelOf: labelOf,
    clearCache: clearSeriesCache,
    setOrders: setOrders, ordersOf: ordersOf, position: posCalc,
    meta: { ask: askMeta, apply: applyMeta, analystOf: analystOf, names: NAMES, analyst: ANA,
            tags: TAGS, earnings: EARN, tagsOf: tagsOf, earningsOf: earningsOf, recs: NREC }, lev: LEV, analyze: analyze, publicBars: PUB, indicators: { sma: sma, ema: ema, macd: macd, kdj: kdj, rsi: rsi }, crosses: crosses };
})();
