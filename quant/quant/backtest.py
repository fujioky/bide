"""Backtests: the subprocess runner (strategies) and the dispatcher that feeds it.

IMPORT RULE: this module's top level must stay stdlib-only. `main.py run-backtest`
imports it in a memory-capped child process that has neither duckdb nor fastapi
loaded; `run_backtest()` therefore imports `.db` lazily.
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import uuid

# quant/quant/backtest.py -> quant/main.py
MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "main.py")

_bt_sem = threading.Semaphore(1)


# ---------------------------------------------------------------- runner (child process)

def bt_runner(spec_path: str) -> None:
    """Invoked as: python main.py run-backtest <spec.json>.
    Only stdlib + pandas + backtrader are imported in this mode."""
    import resource
    try:
        resource.setrlimit(resource.RLIMIT_AS, (900 * 1024 * 1024, 900 * 1024 * 1024))
    except Exception:
        pass
    import pandas as pd
    import backtrader as bt

    with open(spec_path) as f:
        spec = json.load(f)
    out = {"ok": False}
    try:
        df = pd.read_csv(spec["bars_csv"], parse_dates=["ts"]).set_index("ts").sort_index()
        df = df[["open", "high", "low", "close", "volume"]].dropna()
        if len(df) < 30:
            raise ValueError(f"bars too few: {len(df)}")

        class SmaCross(bt.Strategy):
            params = dict(fast=20, slow=60)
            def __init__(self):
                self.cross = bt.ind.CrossOver(
                    bt.ind.SMA(period=int(self.p.fast)), bt.ind.SMA(period=int(self.p.slow)))
            def next(self):
                if not self.position and self.cross[0] > 0:
                    self.buy()
                elif self.position and self.cross[0] < 0:
                    self.close()

        class RsiRev(bt.Strategy):
            params = dict(period=14, low=30, high=70)
            def __init__(self):
                self.rsi = bt.ind.RSI(period=int(self.p.period))
            def next(self):
                if not self.position and self.rsi[0] < float(self.p.low):
                    self.buy()
                elif self.position and self.rsi[0] > float(self.p.high):
                    self.close()

        class Boll(bt.Strategy):
            params = dict(period=20, devfactor=2.0)
            def __init__(self):
                self.b = bt.ind.BollingerBands(period=int(self.p.period), devfactor=float(self.p.devfactor))
            def next(self):
                if not self.position and self.data.close[0] < self.b.bot[0]:
                    self.buy()
                elif self.position and self.data.close[0] > self.b.mid[0]:
                    self.close()

        class BuyHold(bt.Strategy):
            def next(self):
                if not self.position:
                    self.buy()

        class DcaDip(bt.Strategy):
            """每月注资 monthly 进现金池;按收盘价买碎股(不取整)。
            mode: dca=每月立即买 / drawdown=收盘距前高回撤>=trigger 才买 / below_ma=收盘低于 ma 日均线才买"""
            params = dict(monthly=100.0, mode="drawdown", trigger=0.10, ma=200)
            def __init__(self):
                self.pool = 0.0
                self.high_water = 0.0
                self.last_month = None
                self.flows = []          # [[date_iso, amount], ...] 投入现金流(按到账日记)
                self.equity_curve = []   # [[date_iso, account_value], ...]
                self.buys = 0
                self._pending = None     # 上根宣布、本根到账的注资
                self.sma = bt.ind.SMA(period=int(self.p.ma)) if self.p.mode == "below_ma" else None
            def start(self):
                self.broker.set_coc(True)  # 当根收盘成交,现金池扣减与成交价一致
                self.pool = float(self.broker.get_cash())
                self.flows.append([None, self.pool])  # 首笔日期等第一根 bar 补
            def _accrue(self):
                dt = self.data.datetime.date(0)
                di = dt.isoformat()
                if self.flows and self.flows[0][0] is None:
                    self.flows[0][0] = di
                if self._pending is not None:  # 上根 add_cash 本根已入账,记到账日
                    self.flows.append([di, self._pending])
                    self._pending = None
                m = (dt.year, dt.month)
                if self.last_month is None:
                    self.last_month = m
                elif m != self.last_month:
                    self.last_month = m
                    amt = float(self.p.monthly)
                    self.broker.add_cash(amt)  # 下一撮合周期入账
                    self.pool += amt
                    self._pending = amt
                return di
            def _mark(self, di):
                self.equity_curve.append([di, round(float(self.broker.getvalue()), 2)])
            def prenext(self):  # 指标最小周期未满足时也照常注资、记曲线
                self._mark(self._accrue())
            def next(self):
                di = self._accrue()
                px = float(self.data.close[0])
                self.high_water = max(self.high_water, px)
                mode = self.p.mode
                avail = min(self.pool, float(self.broker.get_cash()))  # 在途注资未到账前不可用
                ok = avail > 0 and px > 0
                if mode == "drawdown":
                    ok = ok and px <= self.high_water * (1.0 - float(self.p.trigger))
                elif mode == "below_ma":
                    ok = ok and self.sma is not None and px < float(self.sma[0])
                if ok:
                    size = avail / px  # 碎股：按金额买满，不取整
                    self.buy(size=size)
                    self.pool -= avail
                    self.buys += 1
                self._mark(di)

        builtin = {"sma_cross": SmaCross, "rsi_reversion": RsiRev, "bollinger": Boll,
                   "buy_hold": BuyHold, "dca_dip": DcaDip}
        sname = spec.get("strategy", "sma_cross")
        if sname == "custom":
            ns: dict = {"bt": bt}
            exec(spec.get("custom_code", ""), ns)
            stcls = ns.get("Strategy")
            if stcls is None:
                raise ValueError("custom_code must define a class named `Strategy`")
        else:
            stcls = builtin.get(sname)
            if stcls is None:
                raise ValueError(f"unknown strategy {sname}; builtin: {list(builtin)} or `custom`")

        cash = float(spec.get("cash", 100000))
        cerebro = bt.Cerebro(stdstats=False)
        cerebro.broker.setcash(cash)
        cerebro.broker.setcommission(commission=float(spec.get("commission", 0.0005)))
        cerebro.addsizer(bt.sizers.PercentSizer, percents=float(spec.get("percent", 95)))
        cerebro.adddata(bt.feeds.PandasData(dataname=df))
        params = {k: v for k, v in (spec.get("params") or {}).items()}
        cerebro.addstrategy(stcls, **params)
        cerebro.addanalyzer(bt.analyzers.TimeReturn, timeframe=bt.TimeFrame.Days, _name="tr")
        cerebro.addanalyzer(bt.analyzers.DrawDown, _name="dd")
        cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="ta")
        res = cerebro.run(maxcpus=1)[0]

        flows = getattr(res, "flows", None)
        curve = getattr(res, "equity_curve", None)
        if flows and curve:
            # ---- 现金流口径(定投类策略):TWR 收益序列 + XIRR 资金加权年化 ----
            import statistics
            from datetime import date as _date
            final_v = float(cerebro.broker.getvalue())
            total_in = sum(a for _, a in flows)
            fmap = {}
            for d, a in flows:
                fmap[d] = fmap.get(d, 0.0) + a
            rets, eq3, prev_v, acc = [], [], None, 0.0
            for d, v in curve:
                f = fmap.get(d, 0.0)
                acc += f
                if prev_v is not None and prev_v > 0:
                    rets.append((v - f - prev_v) / prev_v)
                prev_v = v
                eq3.append([d, v, round(acc, 2)])
            twr, peak, mdd = 1.0, 1.0, 0.0
            for r in rets:
                twr *= (1.0 + r)
                peak = max(peak, twr)
                mdd = max(mdd, (peak - twr) / peak)
            sharpe = None
            if len(rets) > 2 and statistics.pstdev(rets) > 0:
                sharpe = statistics.mean(rets) / statistics.pstdev(rets) * (252 ** 0.5)
            def _p(s):
                y, m2, d2 = s.split("-")
                return _date(int(y), int(m2), int(d2))
            d0, dn = _p(curve[0][0]), _p(curve[-1][0])
            cfs = [((_p(d) - d0).days / 365.25, -a) for d, a in flows] + [((dn - d0).days / 365.25, final_v)]
            def npv(rate):
                return sum(a / ((1.0 + rate) ** t) for t, a in cfs)
            mwrr, lo, hi = None, -0.95, 10.0
            try:
                if npv(lo) * npv(hi) < 0:
                    for _ in range(80):
                        mid = (lo + hi) / 2.0
                        if npv(lo) * npv(mid) <= 0:
                            hi = mid
                        else:
                            lo = mid
                    mwrr = (lo + hi) / 2.0
            except Exception:
                mwrr = None
            out = {
                "ok": True,
                "stats": {
                    "mode": "cashflow",
                    "total_contributed": round(total_in, 2),
                    "final_value": round(final_v, 2),
                    "net_profit": round(final_v - total_in, 2),
                    "total_return": round(final_v / total_in - 1.0, 6),
                    "cagr": round(mwrr, 6) if mwrr is not None else None,
                    "sharpe": round(sharpe, 4) if sharpe is not None else None,
                    "max_drawdown_pct": round(mdd * 100, 4),
                    "trades_closed": int(getattr(res, "buys", 0)),
                    "win_rate": None,
                    "bars": len(df),
                    "range": [curve[0][0], curve[-1][0]],
                },
                "equity": eq3,
            }
            with open(spec["result_path"], "w") as f:
                json.dump(out, f)
            return

        trs = res.analyzers.tr.get_analysis()
        eq, v = [], cash
        rets = []
        for dt_, r in sorted(trs.items()):
            r = float(r or 0.0)
            rets.append(r)
            v *= (1.0 + r)
            eq.append([dt_.strftime("%Y-%m-%d"), round(v, 2)])
        final_v = cerebro.broker.getvalue()
        total_ret = final_v / cash - 1.0
        ndays = max((df.index[-1] - df.index[0]).days, 1)
        cagr = (final_v / cash) ** (365.0 / ndays) - 1.0 if final_v > 0 else -1.0
        import statistics
        sharpe = None
        if len(rets) > 2 and statistics.pstdev(rets) > 0:
            sharpe = (statistics.mean(rets) / statistics.pstdev(rets)) * (252 ** 0.5)
        dd = res.analyzers.dd.get_analysis()
        ta = res.analyzers.ta.get_analysis()
        def g(dic, *path, default=None):
            cur = dic
            for p in path:
                if cur is None:
                    return default
                cur = cur.get(p) if hasattr(cur, "get") else None
            return default if cur is None else cur
        closed = g(ta, "total", "closed", default=0) or 0
        won = g(ta, "won", "total", default=0) or 0
        out = {
            "ok": True,
            "stats": {
                "initial_cash": cash,
                "final_value": round(final_v, 2),
                "total_return": round(total_ret, 6),
                "cagr": round(cagr, 6),
                "sharpe": round(sharpe, 4) if sharpe is not None else None,
                "max_drawdown_pct": round(float(g(dd, "max", "drawdown", default=0.0) or 0.0), 4),
                "trades_closed": int(closed),
                "win_rate": round(won / closed, 4) if closed else None,
                "bars": len(df),
                "range": [df.index[0].strftime("%Y-%m-%d"), df.index[-1].strftime("%Y-%m-%d")],
            },
            "equity": eq,
        }
    except MemoryError:
        out = {"ok": False, "error": "backtest exceeded memory limit (900MB)"}
    except Exception as e:  # noqa: BLE001
        out = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    with open(spec["result_path"], "w") as f:
        json.dump(out, f)


# ---------------------------------------------------------------- dispatcher (server side)

def run_backtest(spec: dict):
    """Export cached bars to CSV, run the child process, persist the outcome.
    Returns (http_status, body) so the route can shape the response."""
    from .db import db_exec, query_bars, iso_rows, now_utc  # lazy, see module docstring

    sym = spec.get("symbol", "").upper()
    if not sym:
        return 400, {"error": "symbol required"}
    if not _bt_sem.acquire(timeout=1):
        return 429, {"error": "another backtest is running"}
    bid = uuid.uuid4().hex[:12]
    try:
        tf, source = spec.get("tf", "1d"), spec.get("source", "merged")
        bars = iso_rows(query_bars(sym, tf, spec.get("start", ""), spec.get("end", ""), source))
        if len(bars) < 30:
            return 400, {"error": f"only {len(bars)} bars cached for {sym} {tf} ({source})"}
        tmpd = tempfile.mkdtemp(prefix="bt_")
        csvp = os.path.join(tmpd, "bars.csv")
        with open(csvp, "w") as f:
            f.write("ts,open,high,low,close,volume\n")
            for r in bars:
                f.write(f"{r['ts']},{r['open']},{r['high']},{r['low']},{r['close']},{r['volume']}\n")
        rp = os.path.join(tmpd, "result.json")
        runner_spec = dict(spec); runner_spec.update({"bars_csv": csvp, "result_path": rp})
        sp = os.path.join(tmpd, "spec.json")
        with open(sp, "w") as f:
            json.dump(runner_spec, f)
        db_exec("INSERT INTO backtests VALUES (?,?,?,?,?,?,?,?)",
                [bid, spec.get("name") or f"{sym} {spec.get('strategy','sma_cross')}", now_utc(),
                 json.dumps(spec), "running", None, None, None])
        try:
            subprocess.run([sys.executable, MAIN_PY, "run-backtest", sp],
                           timeout=int(spec.get("timeout", 180)), check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            with open(rp) as f:
                out = json.load(f)
        except subprocess.TimeoutExpired:
            out = {"ok": False, "error": "backtest timeout"}
        except Exception as e:
            out = {"ok": False, "error": f"runner failed: {e}"}
        if out.get("ok"):
            db_exec("UPDATE backtests SET status='done', stats=?, equity=? WHERE id=?",
                    [json.dumps(out["stats"]), json.dumps(out["equity"]), bid])
            return 200, {"id": bid, "status": "done", "stats": out["stats"]}
        db_exec("UPDATE backtests SET status='failed', error=? WHERE id=?", [out.get("error", "?"), bid])
        return 422, {"id": bid, "status": "failed", "error": out.get("error")}
    finally:
        _bt_sem.release()
