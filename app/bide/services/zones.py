"""美股「区间与档位」判定——blog/zones.cjs 的逐函数 Python 移植。

blog/zones.cjs 是唯一口径实现（看板、行情组件、MCP 三处共用）；这里是它的
Python 镜像，供 bide 服务端 / MCP 使用。任何判定规则的改动都应先改 zones.cjs，
再同步到这里，并跑 tests/test_zones_parity.py 用 node 做数值一致性校验。

约定：
- 函数名改 snake_case，与 JS 一一对应（sma/ema/macd/kdj/rsi/crosses/flag_zones/
  bands/analyze/warms/panel/okma/ma_why/wait_of/notes/rank_of/tier_of）。
- 返回的 dict 键保持 JS 原样（camelCase），下游原封不动序列化成 JSON。
- JS null → None，Infinity → float('inf')，数组 → list，对象 → dict。
- rows 与 JS 相同：list，每项 [date_str, open, high, low, close, volume]。

只依赖标准库。
"""
from decimal import Decimal, ROUND_HALF_UP
import math

# ── JS 语义辅助 ──────────────────────────────────────────────────────────────


def _js_round(x):
    """JS Math.round：.5 向正无穷取整（Python round 是银行家舍入）。
    zones.cjs 里目前没有用到 Math.round，留作同口径扩展时使用。"""
    if x != x or x in (float("inf"), float("-inf")):
        return x
    r = math.floor(x)
    return r + 1 if x - r >= 0.5 else r


def _js_to_fixed(x, digits):
    """JS Number.prototype.toFixed：按 double 的精确十进制值取整，恰好落在
    中点时取绝对值更大的那个（即 ROUND_HALF_UP）。Python 的 format 是
    ROUND_HALF_EVEN，例如 0.25 → JS "0.3"，Python "0.2"。"""
    if x != x:
        return "NaN"
    if x == float("inf"):
        return "Infinity"
    if x == float("-inf"):
        return "-Infinity"
    if x == 0:
        x = 0.0  # JS (-0).toFixed(1) === "0.0"
    q = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(q, rounding=ROUND_HALF_UP))


def _at(v, i):
    """JS 的 v[i]：越界（含负下标）得 undefined，这里统一成 None。"""
    if i < 0 or i >= len(v):
        return None
    return v[i]


# ── 指标 ─────────────────────────────────────────────────────────────────────


def sma(v, n):
    o, s = [], 0
    for i in range(len(v)):
        s += v[i]
        if i >= n:
            s -= v[i - n]
        o.append(s / n if i >= n - 1 else None)
    return o


def ema(v, n):
    k = 2 / (n + 1)
    o = []
    p = v[0] if v else None
    for i in range(len(v)):
        p = v[0] if i == 0 else v[i] * k + p * (1 - k)
        o.append(p)
    return o


def macd(c):
    e12, e26 = ema(c, 12), ema(c, 26)
    dif = [e12[i] - e26[i] for i in range(len(c))]
    dea = ema(dif, 9)
    return {"dif": dif, "dea": dea, "bar": [2 * (d - dea[i]) for i, d in enumerate(dif)]}


def kdj(h, l, c, n=None):
    n = n or 9
    K, D, J = [], [], []
    k, d = 50, 50
    for i in range(len(c)):
        if i < n - 1:
            K.append(None)
            D.append(None)
            J.append(None)
            continue
        hh, ll = float("-inf"), float("inf")
        for j in range(i - n + 1, i + 1):
            if h[j] > hh:
                hh = h[j]
            if l[j] < ll:
                ll = l[j]
        rsv = 50 if hh == ll else (c[i] - ll) / (hh - ll) * 100
        k = (2 * k + rsv) / 3
        d = (2 * d + k) / 3
        K.append(k)
        D.append(d)
        J.append(3 * k - 2 * d)
    return {"K": K, "D": D, "J": J}


def rsi(c, n=None):
    n = n or 14
    o, ag, al = [], 0, 0
    for i in range(1, len(c)):
        ch = c[i] - c[i - 1]
        g = ch if ch > 0 else 0
        ls = -ch if ch < 0 else 0
        if i <= n:
            ag += g / n
            al += ls / n
            o.append(None)
            if i == n:
                o[-1] = 100 - 100 / (1 + ag / (al or 1e-9))
        else:
            ag = (ag * (n - 1) + g) / n
            al = (al * (n - 1) + ls) / n
            o.append(100 - 100 / (1 + ag / (al or 1e-9)))
    o.insert(0, None)
    return o


def crosses(a, b, label, dates):
    out = []
    for i in range(1, len(a)):
        if a[i] is None or b[i] is None or a[i - 1] is None or b[i - 1] is None:
            continue
        p = a[i - 1] - b[i - 1]
        n = a[i] - b[i]
        if p <= 0 and n > 0:
            out.append({"i": i, "date": dates[i], "kind": "golden", "what": label})
        elif p >= 0 and n < 0:
            out.append({"i": i, "date": dates[i], "kind": "death", "what": label})
    return out


# RSI 的超卖与强势不是某一天，是一段时间。把连续触及的日子合成区间，
# 相隔不超过 RSI_GAP 个交易日的两段算同一波（取值理由见 zones.cjs 注释）。
RSI_GAP = 10
# 强势区的滞回带：RSI ≥70 才能启动，启动之后 RSI ≥65 就算仍在延续。
RSI_HOT = 65


def flag_zones(flags, gap=None, min_len=None, block=None):
    """block 是「屏障日」：合并时不允许跨过它。"""
    out, i, n = [], 0, len(flags)
    gap = RSI_GAP if gap is None else gap

    def _crosses(a, b):
        if block is None:
            return False
        for k in range(a, b + 1):
            if block[k]:
                return True
        return False

    while i < n:
        if flags[i]:
            j = i
            while j + 1 < n and flags[j + 1]:
                j += 1
            last = out[-1] if out else None
            if last is not None and i - last[1] <= gap and not _crosses(last[1] + 1, i - 1):
                last[1] = j
            else:
                out.append([i, j])
            i = j + 1
        else:
            i += 1
    if min_len:
        out = [z for z in out if z[1] - z[0] + 1 >= min_len]
    return out


# ── 三种区间的划定 ──（规则说明见 zones.cjs bands() 上方注释）


def bands(dates, rs, xs, ma20, ma200, close):
    n = len(dates)
    is_g, is_d = {}, {}
    for x in xs:
        (is_g if x["kind"] == "golden" else is_d)[x["i"]] = True

    EXIT_WAIT = 3
    z_high, z_term, hi_dark = [], [], []
    i = 0
    while i < n:
        if rs[i] is not None and rs[i] >= 70:
            st, k, ex, last_hi, pend = i, i, None, i, None
            while k < n:
                if rs[k] is not None and rs[k] >= RSI_HOT:
                    last_hi = k
                    pend = None
                    k += 1
                    continue
                if pend is not None and is_g.get(k):
                    pend = None
                if pend is not None and k >= pend:
                    ex = k
                    break
                if pend is None and is_d.get(k):
                    pend = k + EXIT_WAIT
                if k - last_hi >= RSI_GAP:
                    ex = k
                    break
                k += 1
            term = ex is not None  # 真的触发了终止信号，而不是画到最新一根
            if ex is None:
                ex = n - 1
            z_high.append([st, ex])
            z_term.append(term)
            if last_hi + RSI_GAP <= n - 1:
                hi_dark.append(last_hi)
            i = ex + 1
        else:
            i += 1
    hi_mask = [False] * n
    for z in z_high:
        for k2 in range(z[0], z[1] + 1):
            hi_mask[k2] = True
    z_low = flag_zones(
        [v is not None and v <= 30 and not hi_mask[j] for j, v in enumerate(rs)],
        RSI_GAP, 2, hi_mask)
    in_rsi = [False] * n
    for z in z_low + z_high:
        for k3 in range(z[0], z[1] + 1):
            in_rsi[k3] = True
    pull = [
        (not in_rsi[j] and j >= 220 and ma200[j] is not None and ma200[j - 20] is not None
         and ma200[j] > ma200[j - 20] and close[j] > ma200[j]
         and ma20[j] is not None and close[j] < ma20[j])
        for j in range(n)
    ]
    z_pull = []
    for z in flag_zones(pull, RSI_GAP, None, in_rsi):
        for k4 in range(z[0], z[1] + 1):
            if is_g.get(k4):
                z_pull.append([k4, z[1]])
                break
    return {"zHigh": z_high, "zTerm": z_term, "zLow": z_low, "zPull": z_pull, "hiDark": hi_dark,
            "isG": is_g, "isD": is_d}


def _series(rows):
    dates = [r[0] for r in rows]
    high = [r[2] for r in rows]
    low = [r[3] for r in rows]
    close = [r[4] for r in rows]
    return dates, high, low, close


def _all_crosses(dates, close, ma5, ma60, ma200, m):
    xs = (crosses(ma5, ma60, "MA5 × MA60", dates)
          + crosses(ma60, ma200, "MA60 × MA200", dates)
          + crosses(m["dif"], m["dea"], "MACD DIF × DEA", dates))
    xs.sort(key=lambda x: x["i"])  # 与 JS 一样是稳定排序
    return xs


def _is_warm(K, D, J, a, b):
    """「将要启动」判据：KDJ 三线聚拢在 40~60、J > K > D，且 DIF > DEA > 0。"""
    if K is None or D is None or J is None or a is None or b is None:
        return False
    if K < 40 or K > 60 or D < 40 or D > 60 or J < 40 or J > 60:
        return False
    if not (J > K and K > D):
        return False
    if not (b > 0 and a > b):
        return False
    return True


def analyze(rows):
    dates, high, low, close = _series(rows)
    n = len(close)
    ma5, ma20, ma60, ma200 = sma(close, 5), sma(close, 20), sma(close, 60), sma(close, 200)
    m, rs, kd_a = macd(close), rsi(close, 14), kdj(high, low, close)
    xs = _all_crosses(dates, close, ma5, ma60, ma200, m)
    B = bands(dates, rs, xs, ma20, ma200, close)
    z_high, z_term, z_low, z_pull = B["zHigh"], B["zTerm"], B["zLow"], B["zPull"]

    # 今日状态只报当天收盘就能知道的：start / exit；「今天是最后一天」不报。
    last = n - 1
    in_zone, edge = None, None
    for kind, zones in (("a", z_high), ("g", z_low), ("b", z_pull)):
        for zi, z in enumerate(zones):
            if z[0] <= last <= z[1]:
                in_zone = {"kind": kind, "from": dates[z[0]], "to": dates[z[1]], "days": last - z[0] + 1}
                if last == z[0]:
                    edge = "start"
                elif kind == "a" and last == z[1] and z_term[zi]:
                    edge = "exit"
    today_x = [{"kind": x["kind"], "what": x["what"]} for x in xs if x["i"] == last]
    # 「将要启动」：最近 30 天内最近一次，返回距今天数。不是买点。
    warm_ago = None
    w2 = last
    while w2 >= 0 and last - w2 <= 30:
        if _is_warm(kd_a["K"][w2], kd_a["D"][w2], kd_a["J"][w2], m["dif"][w2], m["dea"][w2]):
            warm_ago = last - w2
            break
        w2 -= 1
    ma200_last, ma200_prev = ma200[last], _at(ma200, last - 20)
    return {
        "warm": None if warm_ago is None else {"ago": warm_ago, "date": dates[last - warm_ago]},
        "date": dates[last], "close": close[last],
        "chg": (close[last] / close[last - 1] - 1) * 100 if last > 0 else 0,
        "rsi": rs[last], "ma20": ma20[last], "ma60": ma60[last], "ma200": ma200_last,
        "dist200": (close[last] / ma200_last - 1) * 100 if ma200_last else None,
        "up200": (ma200_last > ma200_prev) if (ma200_last is not None and ma200_prev is not None) else None,
        "zone": in_zone, "edge": edge, "todayCross": today_x,
        "zones": {"a": z_high, "g": z_low, "b": z_pull},
        "dates": dates, "close_": close, "high": high, "low": low,
    }


# ── 区间判定 ──（全部沿用原口径，注释见 docs/handoff-design.md）
ZN = {"a": ["强势区", "za"], "g": ["超卖区", "zg"], "b": ["建仓区", "zb"]}


def okma(a):
    return (a is not None and a.get("dist200") is not None
            and a["dist200"] > 0 and a.get("up200") is True)


def ma_why(a):
    if okma(a):
        return "仍在 200 日线上方且均线上行"
    if a.get("dist200") is not None and a["dist200"] <= 0:
        return "已跌破 200 日线"
    return "200 日线掉头向下"


WAIT_MAX = 90


def wait_of(a):
    if not a or a.get("zone") or a.get("zones") is None or a.get("close_") is None:
        return None
    close_ = a["close_"]
    idx = len(close_) - 1
    after = -1
    for z in a["zones"]["a"]:
        if z[1] >= idx:
            return None
        if z[1] > after:
            after = z[1]
    zs = []
    for z in a["zones"]["g"]:
        if z[0] > after and z[1] < idx:
            zs.append({"k": "g", "z": z})
    for z in a["zones"]["b"]:
        if z[0] > after and z[1] < idx:
            zs.append({"k": "b", "z": z})
    if not zs:
        return None
    zs.sort(key=lambda o: o["z"][0])
    days = idx - zs[-1]["z"][1]
    if days > WAIT_MAX:
        return None
    g_lo = g_hi = b_lo = last_hi = None
    for o in zs:
        lo, hi = float("inf"), float("-inf")
        for j in range(o["z"][0], o["z"][1] + 1):
            lo = min(lo, close_[j])
            hi = max(hi, close_[j])
        o["lo"], o["hi"] = lo, hi
        last_hi = hi
        if o["k"] == "g":
            g_lo = lo if g_lo is None else min(g_lo, lo)
            g_hi = hi if g_hi is None else max(g_hi, hi)
        else:
            b_lo = lo if b_lo is None else min(b_lo, lo)
    c = close_[idx]
    if g_lo is not None and c < g_lo:
        pos, ref = "below-g", g_lo
    elif g_lo is not None and c <= g_hi:
        pos, ref = "in-g", g_lo
    elif b_lo is not None and c < b_lo:
        pos, ref = "below-b", b_lo
    elif c > last_hi:
        pos, ref = "above", last_hi
    else:
        pos, ref = "inside", None
    return {
        "pos": pos, "days": days, "gap": 0 if ref is None else (c / ref - 1) * 100,
        "spans": " · ".join(
            ("超卖区 " if o["k"] == "g" else "建仓区 ") + a["dates"][o["z"][0]] + "~" + a["dates"][o["z"][1]]
            for o in zs),
        "okma": (a.get("dist200") is not None and a["dist200"] > 0 and a.get("up200") is True),
    }


def notes(a):
    """说明行：返回结构而不是 HTML。第一条的 z 同时决定卡片外框颜色。
    a 需要先挂上 a['wait'] = wait_of(a)（与 JS 端调用方式一致）。"""
    out = []
    zone = a.get("zone")
    if zone:
        z = ZN[zone["kind"]]
        edge = a.get("edge")
        if edge == "start":
            body = "今天是第一天"
        elif edge == "exit":
            body = "今天出现终止信号"
        else:
            body = "已进行 " + str(zone["days"]) + " 天（是否收尾要次日才能确认）"
        out.append({"z": z[1], "label": z[0], "body": body,
                    "strong": edge == "start" or edge == "exit",
                    "sub": "" if zone["kind"] == "a" else ma_why(a)})
    for c in a["todayCross"]:
        golden = c["kind"] == "golden"
        out.append({"z": "zx" if golden else "zd", "label": "金叉" if golden else "死叉",
                    "body": c["what"], "sub": ""})
    w = a.get("wait")
    if w:
        if w["pos"] == "below-g":
            head = ["补票位 · 超卖区", "zg"]
            body = "比超卖区最低收盘低 " + _js_to_fixed(abs(w["gap"]), 1) + "%"
        elif w["pos"] == "in-g":
            head = ["仍在超卖区价位", "zg"]
            body = "比超卖区最低收盘高 " + _js_to_fixed(abs(w["gap"]), 1) + "%"
        elif w["pos"] == "below-b":
            head = ["补票位 · 建仓区", "zb"]
            body = "比建仓区最低收盘低 " + _js_to_fixed(abs(w["gap"]), 1) + "%"
        elif w["pos"] == "above":
            head = ["高于建仓区", "zn"]
            body = "比最近那段的最高收盘高 " + _js_to_fixed(w["gap"], 1) + "%"
        else:
            head = ["仍在建仓区价位", "zb"]
            body = "价格还在最近那段的范围里"
        out.append({"z": head[1], "label": head[0], "body": body,
                    "sub": "等待强势区第 " + str(w["days"]) + " 天（" + w["spans"] + "）· " + ma_why(a)})
    return out


def rank_of(a):
    """排序 = 今天该拿它怎么办。档位依据见 docs/handoff-design.md 第 3.1 节，实测得来，不要动。"""
    if not a:
        return 0
    has_d = has_g = False
    for c in a["todayCross"]:
        if c["kind"] == "death":
            has_d = True
        else:
            has_g = True
    zone, edge = a.get("zone"), a.get("edge")
    if zone and zone["kind"] == "a":
        if edge == "exit":
            return 100
        if edge == "start":
            return 88
        return 92
    w = a.get("wait")
    if w and w["pos"] == "below-g":
        return 84
    if w and w["pos"] == "in-g":
        return 82
    if zone and zone["kind"] == "g":
        return 83 if edge == "start" else 81
    if w and w["pos"] == "below-b":
        return 80
    if zone:
        return 75 if edge == "start" else 72
    if w and w["pos"] == "inside":
        return 66
    if has_g:
        return 60
    if w:
        return 50
    if has_d:
        return 5
    return 10


def tier_of(r):
    if r >= 100:
        return "强势区终止 · 该清仓"
    if r >= 92:
        return "强势区进行中"
    if r >= 88:
        return "强势区第一天"
    if r >= 84:
        return "补票位 · 超卖区"
    if r >= 83:
        return "超卖区第一天"
    if r >= 82:
        return "仍在超卖区价位"
    if r >= 81:
        return "超卖区进行中"
    if r >= 80:
        return "补票位 · 建仓区"
    if r >= 75:
        return "建仓区第一天"
    if r >= 72:
        return "建仓区进行中"
    if r >= 66:
        return "仍在建仓区价位"
    if r >= 60:
        return "区间外金叉"
    if r >= 50:
        return "高于建仓区"
    if r >= 10:
        return "其它"
    return "死叉"


def warms(rows):
    """全序列的「将要启动」点位：判据与 analyze() 里那段相同，给出历史全部。"""
    dates, high, low, close = _series(rows)
    m, kd = macd(close), kdj(high, low, close)
    out = []
    for i in range(len(close)):
        if _is_warm(kd["K"][i], kd["D"][i], kd["J"][i], m["dif"][i], m["dea"][i]):
            out.append({"i": i, "date": dates[i]})
    return out


def panel(rows):
    """面板底部两张表的数据源：区间统计与交叉记录（权重 蓝区 金叉2/死叉0.5/平常1，强势区 20/5/10）。
    强势区会把之前累计的买入清仓，所以 cost/gain 依赖区间顺序。"""
    a = analyze(rows)
    dates, close, high, low = a["dates"], a["close_"], a["high"], a["low"]
    ma5, ma60, ma200, m = sma(close, 5), sma(close, 60), sma(close, 200), macd(close)
    xs = _all_crosses(dates, close, ma5, ma60, ma200, m)
    xs_g, xs_d = {}, {}
    for x in xs:
        (xs_g if x["kind"] == "golden" else xs_d)[x["i"]] = True

    def w_of(i, kind):
        if kind == "b":
            return 2 if xs_g.get(i) else (0.5 if xs_d.get(i) else 1)
        return 20 if xs_g.get(i) else (5 if xs_d.get(i) else 10)

    lst = ([{"z": z, "k": "g"} for z in a["zones"]["g"]]
           + [{"z": z, "k": "b"} for z in a["zones"]["b"]]
           + [{"z": z, "k": "a"} for z in a["zones"]["a"]])
    lst.sort(key=lambda o: o["z"][0])
    spent, shares, out = 0, 0, []
    for o in lst:
        i0, i1 = o["z"][0], o["z"][1]
        hi, lo = float("-inf"), float("inf")
        for i in range(i0, i1 + 1):
            if high[i] > hi:
                hi = high[i]
            if low[i] < lo:
                lo = low[i]
        r = {
            "kind": o["k"], "name": ZN[o["k"]][0], "from": dates[i0], "to": dates[i1], "days": i1 - i0 + 1,
            "priceLow": lo, "priceHigh": hi, "mid": (lo + hi) / 2,
            "ampPct": (hi / lo - 1) * 100 if lo > 0 else None,
            "ongoing": i1 == len(dates) - 1,
        }
        if o["k"] == "a":
            r["sell"] = close[i1]
            r["chgPct"] = (close[i1] / close[i0] - 1) * 100
            r["cost"] = spent / shares if shares > 0 else None
            r["gainPct"] = (close[i1] / r["cost"] - 1) * 100 if r["cost"] else None
            spent, shares = 0, 0  # 强势区 = 清仓
        else:
            sw = swp = n1 = np_ = 0
            for i in range(i0, i1 + 1):
                w = w_of(i, o["k"])
                sw += w
                swp += w / close[i]
                n1 += 1
                np_ += 1 / close[i]
            r["avg"] = n1 / np_      # 每天等额
            r["wavg"] = sw / swp     # 按金叉死叉加权
            spent += sw
            shares += swp
        out.append(r)
    return {
        "from": dates[0], "to": dates[-1], "bars": len(dates),
        "zones": out,
        "crosses": [{"date": x["date"], "kind": "金叉" if x["kind"] == "golden" else "死叉",
                     "what": x["what"], "close": close[x["i"]]} for x in xs],
        "warmPoints": [{"date": w["date"], "close": close[w["i"]]} for w in warms(rows)],
    }


__all__ = [
    "sma", "ema", "macd", "kdj", "rsi",
    "crosses", "flag_zones", "RSI_GAP", "RSI_HOT",
    "analyze", "warms", "panel", "bands",
    "ZN", "okma", "ma_why", "WAIT_MAX",
    "wait_of", "notes", "rank_of", "tier_of",
]
