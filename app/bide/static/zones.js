/* ══ Lyra 区间与档位判定（唯一实现）══
   看板（server.js 内嵌的 dashboard 脚本）、行情组件（tickerchart.js）与
   MCP（mcp.js）三处共用这一份，任何一处都不要再自己写一遍。
   浏览器里由 /zones.js 加载，挂在 window.LyraZones；Node 里 require 本文件。
   改这里等于同时改看板排序与 MCP 返回值，动之前先看 docs/handoff-design.md 第 3.1 节。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LyraZones = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function sma(v, n) { var o = [], s = 0; for (var i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; o.push(i >= n - 1 ? s / n : null); } return o; }
  function ema(v, n) { var k = 2 / (n + 1), o = [], p = v[0]; for (var i = 0; i < v.length; i++) { p = i === 0 ? v[0] : v[i] * k + p * (1 - k); o.push(p); } return o; }
  function macd(c) {
    var e12 = ema(c, 12), e26 = ema(c, 26);
    var dif = c.map(function (_, i) { return e12[i] - e26[i]; });
    var dea = ema(dif, 9);
    return { dif: dif, dea: dea, bar: dif.map(function (d, i) { return 2 * (d - dea[i]); }) };
  }
  function kdj(h, l, c, n) {
    n = n || 9; var K = [], D = [], J = [], k = 50, d = 50;
    for (var i = 0; i < c.length; i++) {
      if (i < n - 1) { K.push(null); D.push(null); J.push(null); continue; }
      var hh = -Infinity, ll = Infinity;
      for (var j = i - n + 1; j <= i; j++) { if (h[j] > hh) hh = h[j]; if (l[j] < ll) ll = l[j]; }
      var rsv = hh === ll ? 50 : (c[i] - ll) / (hh - ll) * 100;
      k = (2 * k + rsv) / 3; d = (2 * d + k) / 3;
      K.push(k); D.push(d); J.push(3 * k - 2 * d);
    }
    return { K: K, D: D, J: J };
  }
  function rsi(c, n) {
    n = n || 14; var o = [], ag = 0, al = 0;
    for (var i = 1; i < c.length; i++) {
      var ch = c[i] - c[i - 1], g = ch > 0 ? ch : 0, ls = ch < 0 ? -ch : 0;
      if (i <= n) { ag += g / n; al += ls / n; o.push(null); if (i === n) o[o.length - 1] = 100 - 100 / (1 + ag / (al || 1e-9)); }
      else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + ls) / n; o.push(100 - 100 / (1 + ag / (al || 1e-9))); }
    }
    o.unshift(null); return o;
  }
  function crosses(a, b, label, dates) {
    var out = [];
    for (var i = 1; i < a.length; i++) {
      if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
      var p = a[i - 1] - b[i - 1], n = a[i] - b[i];
      if (p <= 0 && n > 0) out.push({ i: i, date: dates[i], kind: 'golden', what: label });
      else if (p >= 0 && n < 0) out.push({ i: i, date: dates[i], kind: 'death', what: label });
    }
    return out;
  }
  /* RSI 的超卖与强势不是某一天，是一段时间。把连续触及的日子合成区间，
     相隔不超过 RSI_GAP 个交易日的两段算同一波。取 10 日：
     再小会留下孤立的单日带，再大（20 日）会把中间隔着一轮回调的两波粘成一条。区间带画的是已经发生的事实，不需要等待确认，
     因此没有前视问题。 */
  var RSI_GAP = 10;
  /* 强势区的滞回带：RSI ≥70 才能启动，启动之后 RSI ≥65 就算仍在延续。
     2026-09-06 在 36 只标的 3 年日线上实测（买入 = 强势区外任一天收盘，
     卖出 = 其后第一个强势区终止日收盘）：延续线取 70（老规则）时 336 次终止里
     有 49 次（15%）三天内又起一段、17 次零间隔，也就是卖飞；取 65 时零间隔归零、
     三天内重启降到 6%，61% 的终止日与老规则完全相同，被延后的那些多拿的收益
     中位 +1.2%、10 分位 −9%。取 60 会改掉 64% 的终止日、把独立的两波并成一波，
     多拿部分中位 0.1% 纯属掷硬币，没有再往下的理由。 */
  var RSI_HOT = 65;
  /* block 是"屏障日"：合并时不允许跨过它。
     否则两段之间夹着一段强势区时，合并会把强势区整个盖住，两种带就重叠了。 */
  function flagZones(flags, gap, minLen, block) {
    var out = [], i = 0, n = flags.length;
    gap = gap == null ? RSI_GAP : gap;
    var crosses = function (a, b) {
      if (!block) return false;
      for (var k = a; k <= b; k++) if (block[k]) return true;
      return false;
    };
    while (i < n) {
      if (flags[i]) {
        var j = i;
        while (j + 1 < n && flags[j + 1]) j++;
        var last = out.length ? out[out.length - 1] : null;
        if (last && i - last[1] <= gap && !crosses(last[1] + 1, i - 1)) last[1] = j;
        else out.push([i, j]);
        i = j + 1;
      } else i++;
    }
    if (minLen) out = out.filter(function (z) { return z[1] - z[0] + 1 >= minLen; });
    return out;
  }
  /* ══ 三种区间的划定 ══ 画图路径（tickerchart.js renderLocal）与 analyze() 共用这一个。
     入参是已经算好的序列，避免调用方重复算指标。

     强势区 zHigh：RSI 第一次 ≥70 就开始，之后一直延续（掉回 70 以下也不算结束），
       直到出现终止信号才停。延续看 RSI_HOT（65）：区间内任何一根 RSI ≥65 都把终止
       倒计时清零——否则 RSI 在 65~70 之间晃一下就切成两段，上一段的终止信号等于卖飞。
       两个终止条件谁先到算谁：①代理信号——出现死叉且其后 EXIT_WAIT=3 个交易日内没有
       金叉，则第 3 天收盘终止；3 天内出现金叉视为没结束，继续等下一次死叉。
       ②兜底——最后一根 RSI≥65 之后满 RSI_GAP=10 个交易日。
     zTerm：这一段是真的触发了终止信号，还是只是画到了最新一根（看板据此报 exit）。
     hiDark：事后回顾标记，真正最后一根 RSI≥70 且其后 10 日确认期已走完（只有画图用）。
     超卖区 zLow：RSI ≤30，强势区的日子当屏障不跨越合并，合并后仍只有一根的丢掉。
     建仓区 zPull：200 日线上行且收盘在其上 + 收盘跌破 20 日线，排除掉已属超卖/强势的日子；
       起点收缩到段内第一个金叉上，整段没有金叉就丢掉。不设最短长度——起点是金叉，
       当天收盘即可知道，哪怕只剩一根也是能照着做的。 */
  function bands(dates, rs, xs, ma20, ma200, close) {
    var n = dates.length, q;
    var isG = {}, isD = {};
    xs.forEach(function (x) { (x.kind === 'golden' ? isG : isD)[x.i] = true; });

    var EXIT_WAIT = 3, zHigh = [], zTerm = [], hiDark = [], i = 0;
    while (i < n) {
      if (rs[i] != null && rs[i] >= 70) {
        var st = i, k = i, ex = null, lastHi = i, pend = null;
        while (k < n) {
          if (rs[k] != null && rs[k] >= RSI_HOT) { lastHi = k; pend = null; k++; continue; }
          if (pend != null && isG[k]) pend = null;
          if (pend != null && k >= pend) { ex = k; break; }
          if (pend == null && isD[k]) pend = k + EXIT_WAIT;
          if (k - lastHi >= RSI_GAP) { ex = k; break; }
          k++;
        }
        var term = (ex != null);          // 真的触发了终止信号，而不是画到最新一根
        if (ex == null) ex = n - 1;
        zHigh.push([st, ex]); zTerm.push(term);
        if (lastHi + RSI_GAP <= n - 1) hiDark.push(lastHi);
        i = ex + 1;
      } else i++;
    }
    var hiMask = [];
    for (q = 0; q < n; q++) hiMask.push(false);
    zHigh.forEach(function (z) { for (var k2 = z[0]; k2 <= z[1]; k2++) hiMask[k2] = true; });
    var zLow = flagZones(rs.map(function (v, j) { return v != null && v <= 30 && !hiMask[j]; }), RSI_GAP, 2, hiMask);
    var inRsi = [];
    for (q = 0; q < n; q++) inRsi.push(false);
    zLow.concat(zHigh).forEach(function (z) { for (var k3 = z[0]; k3 <= z[1]; k3++) inRsi[k3] = true; });
    var pull = dates.map(function (_, j) {
      return !inRsi[j] && j >= 220 && ma200[j] != null && ma200[j - 20] != null &&
        ma200[j] > ma200[j - 20] && close[j] > ma200[j] && ma20[j] != null && close[j] < ma20[j];
    });
    var zPull = [];
    flagZones(pull, RSI_GAP, null, inRsi).forEach(function (z) {
      for (var k4 = z[0]; k4 <= z[1]; k4++) if (isG[k4]) { zPull.push([k4, z[1]]); return; }
    });
    return { zHigh: zHigh, zTerm: zTerm, zLow: zLow, zPull: zPull, hiDark: hiDark,
             isG: isG, isD: isD };
  }

  function analyze(rows) {
    var dates = rows.map(function (r) { return r[0]; });
    var high = rows.map(function (r) { return r[2]; });
    var low = rows.map(function (r) { return r[3]; });
    var close = rows.map(function (r) { return r[4]; });
    var n = close.length;
    var ma5 = sma(close, 5), ma20 = sma(close, 20), ma60 = sma(close, 60), ma200 = sma(close, 200);
    var m = macd(close), rs = rsi(close, 14), kdA = kdj(high, low, close);
    var xs = []
      .concat(crosses(ma5, ma60, 'MA5 × MA60', dates))
      .concat(crosses(ma60, ma200, 'MA60 × MA200', dates))
      .concat(crosses(m.dif, m.dea, 'MACD DIF × DEA', dates));
    xs.sort(function (a, b) { return a.i - b.i; });
    var B = bands(dates, rs, xs, ma20, ma200, close);
    var zHigh = B.zHigh, zTerm = B.zTerm, zLow = B.zLow, zPull = B.zPull;

    /* 今日状态只报当天收盘就能知道的：
         start —— 今天是区间第一天（RSI 触及 30/70、或蓝区起点的金叉，当天可知）
         exit  —— 今天触发了强势区的终止信号（死叉后 3 天无金叉，当天可知）
       「今天是最后一天」不报：区间末根要等后面若干天才能确认，当天无从判断。 */
    var last = n - 1;
    var inZone = null, edge = null;
    [['a', zHigh], ['g', zLow], ['b', zPull]].forEach(function (pair) {
      pair[1].forEach(function (z, zi) {
        if (last >= z[0] && last <= z[1]) {
          inZone = { kind: pair[0], from: dates[z[0]], to: dates[z[1]], days: last - z[0] + 1 };
          if (last === z[0]) edge = 'start';
          else if (pair[0] === 'a' && last === z[1] && zTerm[zi]) edge = 'exit';
        }
      });
    });
    var todayX = xs.filter(function (x) { return x.i === last; })
      .map(function (x) { return { kind: x.kind, what: x.what }; });
    /* 「将要启动」（两形态筛选里的形态二）：KDJ 三线聚拢在 40~60 中轴带、
       J > K > D，同时 DIF > DEA > 0。画图那条路径上本来就在算，但看板要
       按「最近几天有没有出现过」分组，所以这里也算一份，返回距今天数。
       它不是买点，只说明动能快起来了——文案上别写成买入信号。 */
    var warmAgo = null;
    for (var w2 = last; w2 >= 0 && last - w2 <= 30; w2--) {
      var K2 = kdA.K[w2], D2 = kdA.D[w2], J2 = kdA.J[w2], f2a = m.dif[w2], f2b = m.dea[w2];
      if (K2 == null || D2 == null || J2 == null || f2a == null || f2b == null) continue;
      if (K2 < 40 || K2 > 60 || D2 < 40 || D2 > 60 || J2 < 40 || J2 > 60) continue;
      if (!(J2 > K2 && K2 > D2)) continue;
      if (!(f2b > 0 && f2a > f2b)) continue;
      warmAgo = last - w2; break;
    }
    return {
      warm: warmAgo == null ? null : { ago: warmAgo, date: dates[last - warmAgo] },
      date: dates[last], close: close[last],
      chg: last > 0 ? (close[last] / close[last - 1] - 1) * 100 : 0,
      rsi: rs[last], ma20: ma20[last], ma60: ma60[last], ma200: ma200[last],
      dist200: ma200[last] ? (close[last] / ma200[last] - 1) * 100 : null,
      up200: (ma200[last] != null && ma200[last - 20] != null) ? ma200[last] > ma200[last - 20] : null,
      zone: inZone, edge: edge, todayCross: todayX,
      zones: { a: zHigh, g: zLow, b: zPull }, dates: dates, close_: close, high: high, low: low
    };
  }
  /* ══ 区间判定 ══ 全部沿用原口径，注释见 docs/handoff-design.md ══ */
  var ZN = { a: ['强势区', 'za'], g: ['超卖区', 'zg'], b: ['建仓区', 'zb'] };
  function okma(a) { return a && a.dist200 != null && a.dist200 > 0 && a.up200 === true; }
  function maWhy(a) {
    return okma(a) ? '仍在 200 日线上方且均线上行'
      : (a.dist200 != null && a.dist200 <= 0 ? '已跌破 200 日线' : '200 日线掉头向下');
  }
  var WAIT_MAX = 90;
  function waitOf(a) {
    if (!a || a.zone || !a.zones || !a.close_) return null;
    var idx = a.close_.length - 1, i;
    var after = -1;
    for (i = 0; i < a.zones.a.length; i++) {
      if (a.zones.a[i][1] >= idx) return null;
      if (a.zones.a[i][1] > after) after = a.zones.a[i][1];
    }
    var zs = [];
    a.zones.g.forEach(function (z) { if (z[0] > after && z[1] < idx) zs.push({ k: 'g', z: z }); });
    a.zones.b.forEach(function (z) { if (z[0] > after && z[1] < idx) zs.push({ k: 'b', z: z }); });
    if (!zs.length) return null;
    zs.sort(function (x, y) { return x.z[0] - y.z[0]; });
    var days = idx - zs[zs.length - 1].z[1];
    if (days > WAIT_MAX) return null;
    var gLo = null, gHi = null, bLo = null, lastHi = null;
    zs.forEach(function (o) {
      var lo = Infinity, hi = -Infinity, j;
      for (j = o.z[0]; j <= o.z[1]; j++) { lo = Math.min(lo, a.close_[j]); hi = Math.max(hi, a.close_[j]); }
      o.lo = lo; o.hi = hi; lastHi = hi;
      if (o.k === 'g') {
        gLo = (gLo == null) ? lo : Math.min(gLo, lo);
        gHi = (gHi == null) ? hi : Math.max(gHi, hi);
      } else bLo = (bLo == null) ? lo : Math.min(bLo, lo);
    });
    var c = a.close_[idx], pos, ref;
    if (gLo != null && c < gLo) { pos = 'below-g'; ref = gLo; }
    else if (gLo != null && c <= gHi) { pos = 'in-g'; ref = gLo; }
    else if (bLo != null && c < bLo) { pos = 'below-b'; ref = bLo; }
    else if (c > lastHi) { pos = 'above'; ref = lastHi; }
    else { pos = 'inside'; ref = null; }
    return {
      pos: pos, days: days, gap: ref == null ? 0 : (c / ref - 1) * 100,
      spans: zs.map(function (o) {
        return (o.k === 'g' ? '超卖区 ' : '建仓区 ') + a.dates[o.z[0]] + '~' + a.dates[o.z[1]];
      }).join(' · '),
      okma: (a.dist200 != null && a.dist200 > 0 && a.up200 === true)
    };
  }
  /* 说明行：返回结构而不是 HTML，卡片自己决定怎么画。
     第一条的 zone 同时决定卡片外框与左侧色条的颜色。 */
  function notes(a) {
    var out = [];
    if (a.zone) {
      var z = ZN[a.zone.kind];
      out.push({ z: z[1], label: z[0],
        body: a.edge === 'start' ? '今天是第一天'
            : a.edge === 'exit' ? '今天出现终止信号'
            : '已进行 ' + a.zone.days + ' 天（是否收尾要次日才能确认）',
        strong: a.edge === 'start' || a.edge === 'exit',
        sub: a.zone.kind === 'a' ? '' : maWhy(a) });
    }
    a.todayCross.forEach(function (c) {
      out.push({ z: c.kind === 'golden' ? 'zx' : 'zd', label: c.kind === 'golden' ? '金叉' : '死叉',
        body: c.what, sub: '' });
    });
    var w = a.wait;
    if (w) {
      var head, body;
      if (w.pos === 'below-g') { head = ['补票位 · 超卖区', 'zg']; body = '比超卖区最低收盘低 ' + Math.abs(w.gap).toFixed(1) + '%'; }
      else if (w.pos === 'in-g') { head = ['仍在超卖区价位', 'zg']; body = '比超卖区最低收盘高 ' + Math.abs(w.gap).toFixed(1) + '%'; }
      else if (w.pos === 'below-b') { head = ['补票位 · 建仓区', 'zb']; body = '比建仓区最低收盘低 ' + Math.abs(w.gap).toFixed(1) + '%'; }
      else if (w.pos === 'above') { head = ['高于建仓区', 'zn']; body = '比最近那段的最高收盘高 ' + w.gap.toFixed(1) + '%'; }
      else { head = ['仍在建仓区价位', 'zb']; body = '价格还在最近那段的范围里'; }
      out.push({ z: head[1], label: head[0], body: body,
        sub: '等待强势区第 ' + w.days + ' 天（' + w.spans + '）· ' + maWhy(a) });
    }
    return out;
  }
  /* 排序 = 今天该拿它怎么办。档位依据见 docs/handoff-design.md 第 3.1 节，实测得来，不要动。 */
  function rankOf(a) {
    if (!a) return 0;
    var hasD = false, hasG = false;
    a.todayCross.forEach(function (c) { if (c.kind === 'death') hasD = true; else hasG = true; });
    if (a.zone && a.zone.kind === 'a') {
      if (a.edge === 'exit') return 100;
      if (a.edge === 'start') return 88;
      return 92;
    }
    var w = a.wait;
    if (w && w.pos === 'below-g') return 84;
    if (w && w.pos === 'in-g') return 82;
    if (a.zone && a.zone.kind === 'g') return a.edge === 'start' ? 83 : 81;
    if (w && w.pos === 'below-b') return 80;
    if (a.zone) return a.edge === 'start' ? 75 : 72;
    if (w && w.pos === 'inside') return 66;
    if (hasG) return 60;
    if (w) return 50;
    if (hasD) return 5;
    return 10;
  }
  function tierOf(r) {
    if (r >= 100) return '强势区终止 · 该清仓';
    if (r >= 92) return '强势区进行中';
    if (r >= 88) return '强势区第一天';
    if (r >= 84) return '补票位 · 超卖区';
    if (r >= 83) return '超卖区第一天';
    if (r >= 82) return '仍在超卖区价位';
    if (r >= 81) return '超卖区进行中';
    if (r >= 80) return '补票位 · 建仓区';
    if (r >= 75) return '建仓区第一天';
    if (r >= 72) return '建仓区进行中';
    if (r >= 66) return '仍在建仓区价位';
    if (r >= 60) return '区间外金叉';
    if (r >= 50) return '高于建仓区';
    if (r >= 10) return '其它';
    return '死叉';
  }

  /* 全序列的「将要启动」点位：判据与 analyze() 里那段逐字相同，
     只是那边为了看板只回最近一次，这里要给出历史全部。 */
  function warms(rows) {
    var dates = rows.map(function (r) { return r[0]; });
    var high = rows.map(function (r) { return r[2]; });
    var low = rows.map(function (r) { return r[3]; });
    var close = rows.map(function (r) { return r[4]; });
    var m = macd(close), kd = kdj(high, low, close), out = [];
    for (var i = 0; i < close.length; i++) {
      var K = kd.K[i], D = kd.D[i], J = kd.J[i], a = m.dif[i], b = m.dea[i];
      if (K == null || D == null || J == null || a == null || b == null) continue;
      if (K < 40 || K > 60 || D < 40 || D > 60 || J < 40 || J > 60) continue;
      if (!(J > K && K > D)) continue;
      if (!(b > 0 && a > b)) continue;
      out.push({ i: i, date: dates[i] });
    }
    return out;
  }

  /* 面板底部那两张表的数据源：区间统计与交叉记录，覆盖传进来的整段（看板给的是三年）。
     与 tickerchart.js renderLocal 里的 zoneList 逐字段同源——区间来自 analyze()（同一套判定）、
     交叉是主图上画出来的那三对、权重 wOf 与图上一致（蓝区 金叉2/死叉0.5/平常1，强势区 20/5/10）。
     强势区那一段会把在它之前累计的买入清仓，所以 cost/gain 依赖区间顺序，不能单独算一段。 */
  function panel(rows) {
    var a = analyze(rows);
    var dates = a.dates, close = a.close_, high = a.high, low = a.low;
    var ma5 = sma(close, 5), ma60 = sma(close, 60), ma200 = sma(close, 200), m = macd(close);
    var xs = []
      .concat(crosses(ma5, ma60, 'MA5 × MA60', dates))
      .concat(crosses(ma60, ma200, 'MA60 × MA200', dates))
      .concat(crosses(m.dif, m.dea, 'MACD DIF × DEA', dates));
    xs.sort(function (p, q) { return p.i - q.i; });
    var xsG = {}, xsD = {};
    xs.forEach(function (x) { (x.kind === 'golden' ? xsG : xsD)[x.i] = true; });
    var wOf = function (i, kind) {
      if (kind === 'b') return xsG[i] ? 2 : (xsD[i] ? 0.5 : 1);
      return xsG[i] ? 20 : (xsD[i] ? 5 : 10);
    };
    var list = []
      .concat(a.zones.g.map(function (z) { return { z: z, k: 'g' }; }))
      .concat(a.zones.b.map(function (z) { return { z: z, k: 'b' }; }))
      .concat(a.zones.a.map(function (z) { return { z: z, k: 'a' }; }));
    list.sort(function (p, q) { return p.z[0] - q.z[0]; });
    var spent = 0, shares = 0, out = [];
    list.forEach(function (o) {
      var i0 = o.z[0], i1 = o.z[1], i, hi = -Infinity, lo = Infinity;
      for (i = i0; i <= i1; i++) { if (high[i] > hi) hi = high[i]; if (low[i] < lo) lo = low[i]; }
      var r = {
        kind: o.k, name: ZN[o.k][0], from: dates[i0], to: dates[i1], days: i1 - i0 + 1,
        priceLow: lo, priceHigh: hi, mid: (lo + hi) / 2,
        ampPct: lo > 0 ? (hi / lo - 1) * 100 : null,
        ongoing: i1 === dates.length - 1
      };
      if (o.k === 'a') {
        r.sell = close[i1];
        r.chgPct = (close[i1] / close[i0] - 1) * 100;
        r.cost = shares > 0 ? spent / shares : null;
        r.gainPct = r.cost ? (close[i1] / r.cost - 1) * 100 : null;
        spent = 0; shares = 0;                       // 强势区 = 清仓
      } else {
        var sw = 0, swp = 0, n1 = 0, np = 0;
        for (i = i0; i <= i1; i++) {
          var w = wOf(i, o.k);
          sw += w; swp += w / close[i]; n1 += 1; np += 1 / close[i];
        }
        r.avg = n1 / np;                             // 每天等额
        r.wavg = sw / swp;                           // 按金叉死叉加权
        spent += sw; shares += swp;
      }
      out.push(r);
    });
    return {
      from: dates[0], to: dates[dates.length - 1], bars: dates.length,
      zones: out,
      crosses: xs.map(function (x) {
        return { date: x.date, kind: x.kind === 'golden' ? '金叉' : '死叉',
                 what: x.what, close: close[x.i] };
      }),
      warmPoints: warms(rows).map(function (w) { return { date: w.date, close: close[w.i] }; })
    };
  }

  return {
    sma: sma, ema: ema, macd: macd, kdj: kdj, rsi: rsi,
    crosses: crosses, flagZones: flagZones, RSI_GAP: RSI_GAP, RSI_HOT: RSI_HOT,
    analyze: analyze, warms: warms, panel: panel, bands: bands,
    ZN: ZN, okma: okma, maWhy: maWhy, WAIT_MAX: WAIT_MAX,
    waitOf: waitOf, notes: notes, rankOf: rankOf, tierOf: tierOf
  };
});
