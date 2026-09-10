"""信号扫描与邮件正文（规则六：区间 + 200 线上行 + 金叉）。"""
from .db import db_rows

WATCH = ["NOK", "AVGO", "COHR", "VRT", "GEV", "RDW"]
ZONE_MAX = 8.0          # 距 200 日线上方不超过 8% 才算“跌到位”
GAUGES = ["QQQ", "SMH"]


def _closes(sym, n=400):
    rows = db_rows(f"""SELECT ts, close FROM bars WHERE symbol=? AND tf='1d'
                       ORDER BY ts DESC LIMIT {int(n)}""", [sym.upper()])
    rows = list(reversed(rows))
    return [r["ts"] for r in rows], [float(r["close"]) for r in rows]


def _sma(v, n):
    if len(v) < n:
        return None
    return sum(v[-n:]) / n


def _kdj(h, l, c, n=9):
    K, D, k, d = [], [], 50.0, 50.0
    for i in range(len(c)):
        if i < n - 1:
            K.append(None); D.append(None); continue
        hh = max(h[i - n + 1:i + 1]); ll = min(l[i - n + 1:i + 1])
        rsv = 50.0 if hh == ll else (c[i] - ll) / (hh - ll) * 100
        k = (2 * k + rsv) / 3; d = (2 * d + k) / 3
        K.append(k); D.append(d)
    return K, D


def _ema(v, n):
    k = 2.0 / (n + 1); out = []; p = v[0]
    for i, x in enumerate(v):
        p = x if i == 0 else x * k + p * (1 - k)
        out.append(p)
    return out


def _macd(c):
    e12, e26 = _ema(c, 12), _ema(c, 26)
    dif = [a - b for a, b in zip(e12, e26)]
    dea = _ema(dif, 9)
    return dif, dea


def scan_signals():
    """加仓灯 = 三条同时成立（规则六）：
       1) 收盘在 200 日线上方且距离 <= ZONE_MAX%
       2) 200 日线本身在上行（今日 > 20 个交易日前）
       3) 当日出现 MACD 金叉（DIF 上穿 DEA）或 KDJ 金叉（K 上穿 D）"""
    out = {"date": None, "fired": [], "watch": [], "gauges": [], "rule": "区间+200线上行+金叉"}
    for sym in WATCH:
        rows = db_rows("""SELECT ts, high, low, close FROM bars WHERE symbol=? AND tf='1d'
                          ORDER BY ts DESC LIMIT 400""", [sym.upper()])
        rows = list(reversed(rows))
        if len(rows) < 230:
            continue
        ts = [str(r["ts"])[:10] for r in rows]
        h = [float(r["high"]) for r in rows]
        l = [float(r["low"]) for r in rows]
        c = [float(r["close"]) for r in rows]
        out["date"] = ts[-1]
        ma_now = _sma(c, 200)
        ma_20ago = _sma(c[:-20], 200)
        dist = (c[-1] / ma_now - 1) * 100
        rising = ma_20ago is not None and ma_now > ma_20ago
        in_zone = 0 <= dist <= ZONE_MAX
        dif, dea = _macd(c)
        K, D = _kdj(h, l, c)
        macd_x = dif[-2] <= dea[-2] and dif[-1] > dea[-1]
        kdj_x = (K[-2] is not None and D[-2] is not None
                 and K[-2] <= D[-2] and K[-1] > D[-1])
        row = {"symbol": sym, "close": round(c[-1], 2), "ma200": round(ma_now, 2),
               "dist": round(dist, 1), "in_zone": in_zone, "ma200_rising": bool(rising),
               "K": round(K[-1], 1) if K[-1] is not None else None,
               "D": round(D[-1], 1) if D[-1] is not None else None,
               "dif": round(dif[-1], 3), "dea": round(dea[-1], 3),
               "cross": ("MACD 金叉" if macd_x else "") + ("／" if macd_x and kdj_x else "") + ("KDJ 金叉" if kdj_x else "")}
        if in_zone and rising and (macd_x or kdj_x):
            row["why"] = row["cross"]
            out["fired"].append(row)
        out["watch"].append(row)
    for g in GAUGES:
        rows = db_rows("""SELECT ts, close FROM bars WHERE symbol=? AND tf='1d'
                          ORDER BY ts DESC LIMIT 120""", [g.upper()])
        c = [float(r["close"]) for r in reversed(rows)]
        if len(c) < 62:
            continue
        ma60 = _sma(c, 60)
        out["gauges"].append({"symbol": g, "close": round(c[-1], 2), "ma60": round(ma60, 2),
                              "dist": round((c[-1] / ma60 - 1) * 100, 1)})
    return out


def signal_subject(sc) -> str:
    d = sc.get("date") or ""
    if sc["fired"]:
        return "【加仓信号】%s 亮灯 %d 只" % (d, len(sc["fired"]))
    return "【加仓信号】%s 无新亮灯" % d


def signal_html(sc):
    css_td = "padding:7px 10px;border-bottom:1px solid #e2e8f0;font-family:ui-monospace,monospace;font-size:13px"
    h = ['<div style="max-width:620px;margin:0 auto;font-family:-apple-system,\'Noto Sans SC\',sans-serif;color:#2d3748">']
    h.append('<h2 style="font-size:19px;color:#1a202c;margin:0 0 4px">加仓信号 · %s 收盘</h2>' % (sc.get("date") or ""))
    h.append('<div style="font-size:12px;color:#718096;margin-bottom:16px">规则：收盘在 200 日线上方且距离 ≤ %g%%，'
             '200 日线本身上行，且当日出现 MACD 或 KDJ 金叉。建仓期只发加仓灯，不发卖出灯。</div>' % ZONE_MAX)
    if sc["fired"]:
        h.append('<div style="background:#f0fff4;border-left:4px solid #38a169;padding:12px 14px;border-radius:0 8px 8px 0;margin-bottom:14px">')
        h.append('<div style="font-weight:600;color:#2f855a;margin-bottom:8px">今日亮灯 %d 只</div>' % len(sc["fired"]))
        h.append('<table style="width:100%;border-collapse:collapse">')
        for r in sc["fired"]:
            h.append('<tr><td style="%s"><b>%s</b></td><td style="%s">%.2f</td>'
                     '<td style="%s">200日线 %.2f</td><td style="%s">%+.1f%%</td>'
                     '<td style="%s;font-family:inherit;color:#718096">%s</td></tr>'
                     % (css_td, r["symbol"], css_td, r["close"], css_td, r["ma200"],
                        css_td, r["dist"], css_td, r.get("why", "")))
        h.append('</table></div>')
    else:
        h.append('<div style="background:#f7fafc;padding:12px 14px;border-radius:8px;margin-bottom:14px;'
                 'color:#718096;font-size:14px">今日无新亮灯。</div>')
    h.append('<div style="font-size:12px;letter-spacing:.06em;color:#718096;margin:18px 0 6px">全部观察标的</div>')
    h.append('<table style="width:100%;border-collapse:collapse">')
    for r in sc["watch"]:
        ok = r["in_zone"] and r["ma200_rising"]
        mark = "●" if ok else "○"
        col = "#2f855a" if ok else "#a0aec0"
        note = []
        if not r["in_zone"]:
            note.append("不在区间")
        if not r["ma200_rising"]:
            note.append("200日线下行")
        if not note:
            note.append("等金叉" if not r["cross"] else r["cross"])
        h.append('<tr><td style="%s;color:%s">%s %s</td><td style="%s">%.2f</td>'
                 '<td style="%s">200日线 %.2f</td><td style="%s">%+.1f%%</td>'
                 '<td style="%s">K%.0f D%.0f</td>'
                 '<td style="%s;font-family:inherit;color:#718096">%s</td></tr>'
                 % (css_td, col, mark, r["symbol"], css_td, r["close"],
                    css_td, r["ma200"], css_td, r["dist"],
                    css_td, r["K"] or 0, r["D"] or 0,
                    css_td, "、".join(note)))
    h.append('</table>')
    if sc["gauges"]:
        h.append('<div style="font-size:12px;letter-spacing:.06em;color:#718096;margin:18px 0 6px">大盘状态（仅供参考，不作触发条件）</div>')
        h.append('<table style="width:100%;border-collapse:collapse">')
        for g in sc["gauges"]:
            h.append('<tr><td style="%s">%s</td><td style="%s">%.2f</td>'
                     '<td style="%s">60日线 %.2f</td><td style="%s;color:%s">%+.1f%%</td></tr>'
                     % (css_td, g["symbol"], css_td, g["close"], css_td, g["ma60"],
                        css_td, "#c53030" if g["dist"] < 0 else "#2f855a", g["dist"]))
        h.append('</table>')
    h.append('<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;'
             'font-size:11.5px;color:#a0aec0;line-height:1.7">Lyra quant · 数据来自前一美股交易日收盘。'
             '本邮件是规则的机械输出，不构成投资建议。</div></div>')
    return "".join(h)
