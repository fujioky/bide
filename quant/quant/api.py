"""FastAPI app: API-key guard, health, ingest/task/query routes, backtests, /api/run."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone, date

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import API_KEY, MAIL_TO, log
from .db import (SRC_RANK, db_exec, db_executemany, db_rows, db_snapshot, db_size,
                 now_utc, fnum as _f, iso_rows as _iso, tracked_symbols, query_bars)
from .tasks import task_backfill_bars, task_chain_snapshot, task_cboe_chain, task_fundamentals
from .signals import scan_signals, signal_html, signal_subject
from .mail import send_mail
from .backtest import run_backtest
from .public import router as public_router

# ---------------------------------------------------------------- auth (API key only)

def api_ok(req: Request) -> bool:
    return bool(API_KEY) and req.headers.get("x-api-key") == API_KEY


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def guard(req: Request, call_next):
    p = req.url.path
    if p == "/healthz":
        return await call_next(req)
    # 公开只读行情：给博客的行情组件用，无鉴权（自带频率限制与代码白名单校验）
    if p == "/api/public/bars":
        return await call_next(req)
    if p.startswith("/api/"):
        if not api_ok(req):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        return await call_next(req)
    return JSONResponse({"error": "panel removed; API only", "health": "/healthz"}, status_code=404)


@app.get("/healthz")
def healthz():
    n = db_rows("SELECT (SELECT count(*) FROM bars) b, (SELECT count(*) FROM option_chain) o, (SELECT count(*) FROM fundamentals) f")[0]
    return {"ok": True, "bars": n["b"], "option_rows": n["o"], "fundamental_rows": n["f"]}


# ---------------------------------------------------------------- data APIs

@app.post("/api/symbols/track")
async def api_track(req: Request):
    b = await req.json()
    sym = (b.get("symbol") or "").strip().upper()
    if not sym:
        return JSONResponse({"error": "symbol required"}, status_code=400)
    db_exec("INSERT OR REPLACE INTO symbols VALUES (?,?,?)", [sym, now_utc(), b.get("note")])
    res = {"tracked": sym}
    if b.get("bootstrap", True):
        def _boot():
            try:
                res1 = task_backfill_bars(sym, b.get("period", "10y")); log("boot bars", sym, res1)
                res2 = task_chain_snapshot(sym); log("boot chain", sym, res2.get("inserted"))
                res3 = task_fundamentals(sym); log("boot fnd", sym, res3)
            except Exception as e:
                log("bootstrap fail", sym, e)
        threading.Thread(target=_boot, daemon=True).start()
        res["bootstrap"] = "started (bars 10y + chain snapshot + fundamentals via yfinance, async)"
    return res


@app.delete("/api/symbols/{sym}")
def api_untrack(sym: str):
    db_exec("DELETE FROM symbols WHERE symbol=?", [sym.upper()])
    return {"untracked": sym.upper(), "note": "cached data kept"}


@app.post("/api/ingest/bars")
async def api_ingest_bars(req: Request):
    b = await req.json()
    sym, tf, src = b["symbol"].upper(), b.get("tf", "1d"), b.get("source", "ibkr")
    rows = []
    for bar in b.get("bars", []):
        ts = bar.get("ts")
        if isinstance(ts, (int, float)):
            dt = datetime.fromtimestamp(ts / (1000 if ts > 1e12 else 1), tz=timezone.utc).replace(tzinfo=None)
        else:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if dt.tzinfo:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        if tf == "1d":
            dt = datetime(dt.year, dt.month, dt.day)
        rows.append((sym, tf, dt, _f(bar.get("o")), _f(bar.get("h")), _f(bar.get("l")),
                     _f(bar.get("c")), _f(bar.get("v")) or 0, src))
    if rows:
        db_executemany("INSERT OR REPLACE INTO bars VALUES (?,?,?,?,?,?,?,?,?)", rows)
    db_exec("INSERT OR REPLACE INTO symbols VALUES (?, coalesce((SELECT added_at FROM symbols WHERE symbol=?), ?), (SELECT note FROM symbols WHERE symbol=?))",
            [sym, sym, now_utc(), sym])
    return {"symbol": sym, "tf": tf, "source": src, "inserted": len(rows)}


@app.post("/api/ingest/option_chain")
async def api_ingest_chain(req: Request):
    b = await req.json()
    und, src = b["underlying"].upper(), b.get("source", "ibkr")
    snap = b.get("snapshot_ts")
    snap = (datetime.fromisoformat(snap.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
            if snap else now_utc())
    rows = []
    for r in b.get("rows", []):
        e = str(r["expiry"])
        ed = date(int(e[0:4]), int(e[4:6]), int(e[6:8])) if len(e) == 8 and e.isdigit() else date.fromisoformat(e)
        rows.append((und, snap, ed, float(r["strike"]), r["right"].upper()[0],
                     _f(r.get("bid")), _f(r.get("ask")), _f(r.get("last")), _f(r.get("iv")),
                     _f(r.get("volume")), _f(r.get("open_interest")), src,
                     json.dumps(r.get("extra")) if r.get("extra") else None))
    if rows:
        db_executemany("INSERT OR REPLACE INTO option_chain VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return {"underlying": und, "snapshot_ts": snap.isoformat(), "inserted": len(rows), "source": src}


@app.post("/api/tasks/backfill")
async def api_backfill(req: Request):
    b = await req.json()
    return task_backfill_bars(b["symbol"].upper(), b.get("period", "10y"))


@app.post("/api/tasks/chain_snapshot")
async def api_chain(req: Request):
    b = await req.json()
    return task_chain_snapshot(b["symbol"].upper(), int(b.get("expirations", 2)))


@app.get("/api/signals")
def api_signals():
    return scan_signals()


@app.post("/api/tasks/signal_mail")
async def api_signal_mail(req: Request):
    b = {}
    try:
        b = await req.json()
    except Exception:
        pass
    sc = scan_signals()
    if b.get("dry"):
        return {"dry": True, "scan": sc, "to": list(MAIL_TO)}
    subj = b.get("subject") or signal_subject(sc)
    return {"sent": send_mail(subj, signal_html(sc)), "scan": sc}


@app.post("/api/tasks/cboe_chain")
async def api_cboe(req: Request):
    b = await req.json()
    return task_cboe_chain(b["symbol"].upper(), int(b.get("expirations", 2)))


@app.post("/api/tasks/fundamentals")
async def api_fnd(req: Request):
    b = await req.json()
    return task_fundamentals(b["symbol"].upper())


@app.get("/api/coverage")
def api_coverage():
    bars = db_rows(f"""SELECT symbol, tf, source, count(*) n, min(ts) t0, max(ts) t1
                       FROM bars GROUP BY 1,2,3 ORDER BY 1,2,{SRC_RANK}""")
    chains = db_rows("""SELECT underlying, source, max(snapshot_ts) last_snap,
                        count(DISTINCT snapshot_ts) snaps, count(*) nrows FROM option_chain GROUP BY 1,2""")
    fnd = db_rows("""SELECT symbol, statement, freq, count(DISTINCT period_end) periods,
                     max(period_end) latest FROM fundamentals GROUP BY 1,2,3""")
    bts = db_rows("SELECT count(*) n FROM backtests")[0]["n"]
    return {"tracked": tracked_symbols(), "bars": _iso(bars), "option_chains": _iso(chains),
            "fundamentals": _iso(fnd), "backtests": bts, "db_bytes": db_size()}


@app.get("/api/bars.json")
def api_bars(symbol: str, tf: str = "1d", start: str = "", end: str = "", source: str = "merged"):
    return {"symbol": symbol.upper(), "tf": tf, "source": source,
            "bars": _iso(query_bars(symbol, tf, start, end, source))}


app.include_router(public_router)


@app.get("/api/options/snapshots")
def api_snaps(underlying: str):
    return {"underlying": underlying.upper(), "snapshots": _iso(db_rows(
        """SELECT snapshot_ts, source, count(DISTINCT expiry) expiries, count(*) nrows
           FROM option_chain WHERE underlying=? GROUP BY 1,2 ORDER BY 1 DESC""", [underlying.upper()]))}


@app.get("/api/options/chain.json")
def api_chain_get(underlying: str, snapshot_ts: str, source: str, expiry: str = ""):
    where, params = "underlying=? AND snapshot_ts=? AND source=?", [underlying.upper(), snapshot_ts, source]
    if expiry:
        where += " AND expiry=?"; params.append(expiry)
    rows = db_rows(f'SELECT * FROM option_chain WHERE {where} ORDER BY expiry, strike, "right"', params)
    return {"underlying": underlying.upper(), "rows": _iso(rows)}


@app.get("/api/fundamentals.json")
def api_fnd_get(symbol: str, statement: str = "", freq: str = ""):
    where, params = "symbol=?", [symbol.upper()]
    if statement:
        where += " AND statement=?"; params.append(statement)
    if freq:
        where += " AND freq=?"; params.append(freq)
    return {"symbol": symbol.upper(), "rows": _iso(db_rows(
        f"SELECT statement,freq,period_end,item,value FROM fundamentals WHERE {where} ORDER BY statement,freq,period_end DESC", params))}


# ---------------------------------------------------------------- backtests

@app.post("/api/backtest")
async def api_backtest(req: Request):
    spec = await req.json()
    status, body = run_backtest(spec)
    if status == 200:
        return body
    return JSONResponse(body, status_code=status)


@app.get("/api/backtests.json")
def api_bts():
    return {"backtests": _iso(db_rows(
        "SELECT id,name,created_at,status,stats,error FROM backtests ORDER BY created_at DESC LIMIT 200"))}


@app.get("/api/backtest/{bid}.json")
def api_bt(bid: str):
    r = db_rows("SELECT * FROM backtests WHERE id=?", [bid])
    if not r:
        return JSONResponse({"error": "not found"}, status_code=404)
    row = _iso(r)[0]
    for k in ("spec", "stats", "equity"):
        if row.get(k):
            row[k] = json.loads(row[k])
    return row


# ---------------------------------------------------------------- arbitrary analysis runner

def _limit_mem():
    import resource
    try:
        resource.setrlimit(resource.RLIMIT_AS, (900 * 1024 * 1024, 900 * 1024 * 1024))
    except Exception:
        pass


@app.post("/api/run")
async def api_run(req: Request):
    """POST {code, timeout?}: 在子进程跑一段 Python。环境变量 QDB 指向 DuckDB 只读快照。"""
    b = await req.json()
    code = b.get("code") or ""
    if not code:
        return JSONResponse({"error": "code required"}, status_code=400)
    timeout = min(int(b.get("timeout", 120)), 600)
    tmpd = tempfile.mkdtemp(prefix="run_")
    try:
        snap = os.path.join(tmpd, "quant.duckdb")
        db_snapshot(snap)
        script = os.path.join(tmpd, "job.py")
        with open(script, "w") as f:
            f.write(code)
        env = {"QDB": snap, "PATH": os.environ.get("PATH", ""), "HOME": tmpd, "LANG": "C.UTF-8"}
        try:
            p = subprocess.run([sys.executable, script], cwd=tmpd, env=env,
                               capture_output=True, text=True, timeout=timeout,
                               preexec_fn=_limit_mem)
            return {"returncode": p.returncode, "stdout": p.stdout[-40000:], "stderr": p.stderr[-8000:]}
        except subprocess.TimeoutExpired:
            return JSONResponse({"error": f"timeout {timeout}s"}, status_code=408)
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)
