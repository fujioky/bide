"""Data-pull tasks: yfinance bars / chains / statements, CBOE delayed chain, vol snapshot."""
import json
import math
from datetime import datetime, timezone, date

from .config import log
from .db import (SRC_RANK, db_exec, db_executemany, db_rows, now_utc, fnum as _f)

CBOE_URL = "https://cdn.cboe.com/api/global/delayed_quotes/options/{}.json"


def yf_ticker(sym):
    import yfinance as yf
    return yf.Ticker(sym)


def task_backfill_bars(sym: str, period: str = "10y") -> dict:
    t = yf_ticker(sym)
    # auto_adjust=True: 拆合股 + 股息再投入（总回报口径）
    df = t.history(period=period, interval="1d", auto_adjust=True)
    if df is None or df.empty:
        return {"symbol": sym, "inserted": 0, "note": "yfinance empty"}
    rows = []
    for idx, r in df.iterrows():
        d = idx.date()
        rows.append((sym.upper(), "1d", datetime(d.year, d.month, d.day),
                     float(r["Open"]), float(r["High"]), float(r["Low"]),
                     float(r["Close"]), float(r.get("Volume") or 0), "yfinance"))
    db_executemany("INSERT OR REPLACE INTO bars VALUES (?,?,?,?,?,?,?,?,?)", rows)
    return {"symbol": sym, "inserted": len(rows), "source": "yfinance", "period": period}


def task_chain_snapshot(sym: str, n_exp: int = 2) -> dict:
    t = yf_ticker(sym)
    exps = list(t.options or [])[:n_exp]
    if not exps:
        return {"symbol": sym, "inserted": 0, "note": "no option expirations on yfinance"}
    snap = now_utc()
    rows = []
    for e in exps:
        try:
            ch = t.option_chain(e)
        except Exception as ex:
            log("chain fail", sym, e, ex)
            continue
        ed = datetime.strptime(e, "%Y-%m-%d").date()
        for right, df in (("C", ch.calls), ("P", ch.puts)):
            for _, r in df.iterrows():
                rows.append((sym.upper(), snap, ed, float(r["strike"]), right,
                             _f(r.get("bid")), _f(r.get("ask")), _f(r.get("lastPrice")),
                             _f(r.get("impliedVolatility")), _f(r.get("volume")),
                             _f(r.get("openInterest")), "yfinance", None))
    if rows:
        db_executemany("INSERT OR REPLACE INTO option_chain VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return {"symbol": sym, "inserted": len(rows), "snapshot_ts": snap.isoformat(), "expirations": exps}


def _monthlies(codes, n):
    """Pick the n nearest standard monthly expiries (3rd Friday) from YYMMDD codes."""
    out = []
    today = date.today()
    for c in sorted(set(codes)):
        try:
            d = datetime.strptime("20" + c, "%Y%m%d").date()
        except Exception:
            continue
        if d < today or d.weekday() != 4 or not (15 <= d.day <= 21):
            continue
        out.append((c, d))
    return out[:n]


def task_cboe_chain(sym: str, n_exp: int = 2) -> dict:
    """Full option chain with real OI / IV / greeks from CBOE's public delayed feed."""
    import urllib.request
    req = urllib.request.Request(CBOE_URL.format(sym.upper()),
                                 headers={"User-Agent": "Mozilla/5.0"})
    d = json.loads(urllib.request.urlopen(req, timeout=45).read())["data"]
    opts = d.get("options") or []
    keep = dict(_monthlies([o["option"][-15:-9] for o in opts], n_exp))
    if not keep:
        return {"symbol": sym, "inserted": 0, "note": "no monthly expiry found"}
    snap = now_utc()
    rows = []
    for o in opts:
        tail = o["option"][-15:]
        code = tail[:6]
        if code not in keep:
            continue
        extra = json.dumps({k: o.get(k) for k in ("delta", "gamma", "vega", "theta", "theo")})
        rows.append((sym.upper(), snap, keep[code], int(tail[7:]) / 1000.0, tail[6],
                     _f(o.get("bid")), _f(o.get("ask")), _f(o.get("last_trade_price")),
                     _f(o.get("iv")), _f(o.get("volume")), _f(o.get("open_interest")),
                     "cboe", extra))
    if rows:
        db_executemany("INSERT OR REPLACE INTO option_chain VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return {"symbol": sym, "inserted": len(rows), "snapshot_ts": snap.isoformat(),
            "expirations": [str(v) for v in keep.values()], "spot": d.get("current_price"),
            "iv30": d.get("iv30")}


def hv30_from_bars(sym: str) -> float:
    """30 日历史波动率（对数收益标准差年化）"""
    rows = db_rows(f"""SELECT close FROM (
        SELECT *, row_number() OVER (PARTITION BY ts ORDER BY {SRC_RANK}) rn
        FROM bars WHERE symbol=? AND tf='1d') WHERE rn=1 ORDER BY ts DESC LIMIT 31""", [sym])
    c = [float(r["close"]) for r in rows][::-1]
    if len(c) < 21:
        return None
    rets = [math.log(c[i] / c[i - 1]) for i in range(1, len(c)) if c[i - 1] > 0]
    if len(rets) < 20:
        return None
    mu = sum(rets) / len(rets)
    var = sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)
    return math.sqrt(var) * math.sqrt(252) * 100


def task_vol_snapshot(sym: str, target_days: int = 30) -> dict:
    """从 yfinance 期权链取平值隐含波动率，配上从日线算的 HV30，逐日入库。
    取最接近 target_days 天到期的那一档，用离现价最近的行权价，call/put 取均值。"""
    from .public import norm_sym  # lazy: public imports tasks
    sym = norm_sym(sym)
    t = yf_ticker(sym)
    hv = hv30_from_bars(sym)
    today = datetime.now(timezone.utc).date()
    try:
        exps = list(t.options or [])
    except Exception as e:
        return {"symbol": sym, "note": "no options: %s" % e, "hv30": hv}
    if not exps:
        if hv is None:
            return {"symbol": sym, "note": "no options, no hv"}
        db_exec("INSERT OR REPLACE INTO vol_daily VALUES (?,?,?,?,?,?,?,?)",
                [sym, today, None, hv, None, None, "yfinance", datetime.now(timezone.utc)])
        return {"symbol": sym, "iv": None, "hv30": hv, "note": "no options"}

    def dte(e):
        try:
            return abs((date.fromisoformat(e) - today).days - target_days)
        except Exception:
            return 9999
    exp = min(exps, key=dte)
    ch = t.option_chain(exp)
    spot = None
    try:
        h = t.history(period="5d", interval="1d")
        if h is not None and len(h):
            spot = float(h["Close"].iloc[-1])
    except Exception:
        pass
    if spot is None:
        return {"symbol": sym, "note": "no spot"}

    def atm_iv(df):
        best, bd = None, 1e18
        for _, row in df.iterrows():
            try:
                k = float(row["strike"]); v = float(row["impliedVolatility"])
            except Exception:
                continue
            if not (v and v > 0.01 and v < 5):
                continue
            d0 = abs(k - spot)
            if d0 < bd:
                bd, best = d0, v
        return best
    ivc, ivp = atm_iv(ch.calls), atm_iv(ch.puts)
    vals = [x for x in (ivc, ivp) if x]
    iv = (sum(vals) / len(vals) * 100) if vals else None
    db_exec("INSERT OR REPLACE INTO vol_daily VALUES (?,?,?,?,?,?,?,?)",
            [sym, today, iv, hv, spot, date.fromisoformat(exp), "yfinance",
             datetime.now(timezone.utc)])
    return {"symbol": sym, "d": str(today), "iv": iv, "hv30": hv, "expiry": exp, "spot": spot}


def task_fundamentals(sym: str) -> dict:
    t = yf_ticker(sym)
    pairs = [("income", "annual", t.income_stmt), ("income", "quarterly", t.quarterly_income_stmt),
             ("balance", "annual", t.balance_sheet), ("balance", "quarterly", t.quarterly_balance_sheet),
             ("cashflow", "annual", t.cashflow), ("cashflow", "quarterly", t.quarterly_cashflow)]
    rows, fetched = [], now_utc()
    for stmt, freq, df in pairs:
        try:
            if df is None or df.empty:
                continue
            for period in df.columns:
                pe = period.date() if hasattr(period, "date") else None
                if pe is None:
                    continue
                for item in df.index:
                    v = _f(df.loc[item, period])
                    if v is None:
                        continue
                    rows.append((sym.upper(), stmt, freq, pe, str(item), v, "yfinance", fetched))
        except Exception as ex:
            log("fundamentals fail", sym, stmt, freq, ex)
    if rows:
        db_executemany("INSERT OR REPLACE INTO fundamentals VALUES (?,?,?,?,?,?,?,?)", rows)
    return {"symbol": sym, "inserted": len(rows)}
