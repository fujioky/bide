"""DuckDB connection, schema, and the small query helpers every module shares."""
import math
import os
import shutil
import threading
from datetime import datetime, timezone, date

import duckdb

from .config import DATA_DIR, DB_PATH

# Source precedence when the same bar exists from several feeds.
SRC_RANK = "CASE source WHEN 'ibkr' THEN 1 WHEN 'cboe' THEN 2 WHEN 'yfinance' THEN 3 ELSE 4 END"

os.makedirs(DATA_DIR, exist_ok=True)

_db_lock = threading.RLock()
con = duckdb.connect(DB_PATH)
con.execute("""
CREATE TABLE IF NOT EXISTS bars(
  symbol VARCHAR, tf VARCHAR, ts TIMESTAMP, open DOUBLE, high DOUBLE, low DOUBLE,
  close DOUBLE, volume DOUBLE, source VARCHAR,
  PRIMARY KEY(symbol, tf, ts, source));
CREATE TABLE IF NOT EXISTS option_chain(
  underlying VARCHAR, snapshot_ts TIMESTAMP, expiry DATE, strike DOUBLE, "right" VARCHAR,
  bid DOUBLE, ask DOUBLE, last DOUBLE, iv DOUBLE, volume DOUBLE, open_interest DOUBLE,
  source VARCHAR, extra VARCHAR,
  PRIMARY KEY(underlying, snapshot_ts, expiry, strike, "right", source));
CREATE TABLE IF NOT EXISTS fundamentals(
  symbol VARCHAR, statement VARCHAR, freq VARCHAR, period_end DATE, item VARCHAR,
  value DOUBLE, source VARCHAR, fetched_at TIMESTAMP,
  PRIMARY KEY(symbol, statement, freq, period_end, item));
CREATE TABLE IF NOT EXISTS symbols(symbol VARCHAR PRIMARY KEY, added_at TIMESTAMP, note VARCHAR);
CREATE TABLE IF NOT EXISTS vol_daily(
  symbol VARCHAR, d DATE, iv DOUBLE, hv30 DOUBLE, spot DOUBLE, expiry DATE,
  source VARCHAR, fetched_at TIMESTAMP,
  PRIMARY KEY(symbol, d, source));
CREATE TABLE IF NOT EXISTS backtests(
  id VARCHAR PRIMARY KEY, name VARCHAR, created_at TIMESTAMP, spec VARCHAR,
  status VARCHAR, stats VARCHAR, equity VARCHAR, error VARCHAR);
""")


def db_exec(sql, params=None):
    with _db_lock:
        return con.execute(sql, params or [])


def db_executemany(sql, rows):
    with _db_lock:
        return con.executemany(sql, rows)


def db_rows(sql, params=None):
    with _db_lock:
        cur = con.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def db_snapshot(path: str) -> None:
    """Checkpoint and copy the database file (read-only snapshot for /api/run)."""
    with _db_lock:
        con.execute("CHECKPOINT")
        shutil.copyfile(DB_PATH, path)


def db_size() -> int:
    return os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0


def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def fnum(v):
    """float() that maps NaN / unparsable to None."""
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except Exception:
        return None


def iso_rows(rows):
    for r in rows:
        for k, v in r.items():
            if isinstance(v, (datetime, date)):
                r[k] = v.isoformat()
    return rows


def tracked_symbols():
    return [r["symbol"] for r in db_rows("SELECT symbol FROM symbols ORDER BY symbol")]


def universe_symbols():
    """Everything we hold bars for; falls back to the tracked table."""
    rows = db_rows("SELECT DISTINCT symbol FROM bars ORDER BY 1")
    return [r["symbol"] for r in rows] or tracked_symbols()


def query_bars(symbol: str, tf: str = "1d", start: str = "", end: str = "", source: str = "merged"):
    """Bars for one symbol; `merged` picks the best source per timestamp by SRC_RANK."""
    sym = symbol.upper()
    where, params = "symbol=? AND tf=?", [sym, tf]
    if start:
        where += " AND ts >= ?"; params.append(start)
    if end:
        where += " AND ts <= ?"; params.append(end)
    if source == "merged":
        sql = f"""SELECT ts,open,high,low,close,volume,source FROM (
                  SELECT *, row_number() OVER (PARTITION BY ts ORDER BY {SRC_RANK}) rn
                  FROM bars WHERE {where}) WHERE rn=1 ORDER BY ts"""
    else:
        sql = f"SELECT ts,open,high,low,close,volume,source FROM bars WHERE {where} AND source=? ORDER BY ts"
        params.append(source)
    return db_rows(sql, params)
