#!/usr/bin/env python3
"""Lyra quant — US equity/option data cache + backtest service.

FastAPI app (package `quant/`), API only — every /api/* route requires X-API-Key
(the web panel was removed long ago); /healthz and /api/public/bars are open.
  * DuckDB on /data (persistent volume): bars / option_chain / fundamentals / symbols / backtests
  * Ingest API — Claude pushes IBKR data here via MCP->curl
  * yfinance / CBOE fallback tasks: deep bar backfill, daily top-up, option chain snapshots, statements
  * backtrader engine run in a subprocess (memory-capped) fed by CSV export
  * signal scan mailed over direct SMTP (SMTP_* / MAIL_TO env)

Modes:
  python main.py                         # serve on :$PORT
  python main.py run-backtest spec.json  # child-process runner: stdlib + pandas + backtrader only
"""
import sys

if len(sys.argv) >= 3 and sys.argv[1] == "run-backtest":
    # Must not import quant.api / quant.db here: the runner is memory-capped and
    # should never load duckdb, fastapi or yfinance.
    from quant.backtest import bt_runner
    bt_runner(sys.argv[2])
    sys.exit(0)

if __name__ == "__main__":
    import uvicorn
    from quant.config import PORT, DB_PATH, AUTO_JOBS, log
    from quant.api import app
    from quant.jobs import start_scheduler

    start_scheduler()
    log(f"listening :{PORT}, db={DB_PATH}, auto_jobs={AUTO_JOBS}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
