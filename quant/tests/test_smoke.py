"""Smoke tests against the packaged service — TestClient + synthetic bars, no network.

Covers: guard rules, /healthz, ingest -> coverage/bars.json, /api/public/bars (CORS,
cache headers, alias, validation, rate limit), the subprocess backtest runner, the
runner's import isolation, /api/run, and the SMTP mail channel (faked smtplib).
"""
import json
import os
import random
import subprocess
import sys
from datetime import date, timedelta

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYM = "NVDA"
N_BARS = 300


def synth_bars(n=N_BARS, seed=7, end=None):
    """n daily bars ending at `end` (default: today), weekdays only, random walk."""
    rng = random.Random(seed)
    end = end or date.today()
    days, d = [], end
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    days.reverse()
    px, out = 100.0, []
    for d in days:
        o = px
        c = max(1.0, o * (1 + rng.gauss(0.0005, 0.02)))
        h, l = max(o, c) * (1 + abs(rng.gauss(0, 0.005))), min(o, c) * (1 - abs(rng.gauss(0, 0.005)))
        out.append({"ts": d.isoformat(), "o": round(o, 4), "h": round(h, 4),
                    "l": round(l, 4), "c": round(c, 4), "v": rng.randint(1_000_000, 5_000_000)})
        px = c
    return out


# ---------------------------------------------------------------- guard / health

def test_healthz_is_open(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert set(r.json()) == {"ok", "bars", "option_rows", "fundamental_rows"}
    assert r.json()["ok"] is True


def test_guard_rules(client):
    assert client.get("/api/coverage").status_code == 401
    assert client.get("/api/coverage").json() == {"error": "unauthorized"}
    assert client.get("/api/coverage", headers={"X-API-Key": "wrong"}).status_code == 401
    r = client.get("/")
    assert r.status_code == 404
    assert r.json() == {"error": "panel removed; API only", "health": "/healthz"}
    assert client.get("/login").status_code == 404
    # public bars passes the guard without a key (validation runs, not auth)
    r = client.get("/api/public/bars", params={"symbol": "bad symbol!"},
                   headers={"x-forwarded-for": "10.0.0.1"})
    assert r.status_code == 400
    assert r.json() == {"error": "bad symbol"}


# ---------------------------------------------------------------- ingest + query

def test_ingest_bars_then_coverage(client, key):
    r = client.post("/api/ingest/bars", json={"symbol": SYM.lower(), "bars": synth_bars()}, headers=key)
    assert r.status_code == 200
    assert r.json() == {"symbol": SYM, "tf": "1d", "source": "ibkr", "inserted": N_BARS}

    cov = client.get("/api/coverage", headers=key).json()
    assert set(cov) == {"tracked", "bars", "option_chains", "fundamentals", "backtests", "db_bytes"}
    assert cov["tracked"] == [SYM]
    row = [b for b in cov["bars"] if b["symbol"] == SYM][0]
    assert row["tf"] == "1d" and row["source"] == "ibkr" and row["n"] == N_BARS
    assert isinstance(row["t0"], str) and isinstance(row["t1"], str)  # datetimes iso-encoded

    assert client.get("/healthz").json()["bars"] == N_BARS


def test_bars_json_merged_and_source(client, key):
    r = client.get("/api/bars.json", params={"symbol": SYM}, headers=key)
    assert r.status_code == 200
    j = r.json()
    assert j["symbol"] == SYM and j["tf"] == "1d" and j["source"] == "merged"
    assert len(j["bars"]) == N_BARS
    assert set(j["bars"][0]) == {"ts", "open", "high", "low", "close", "volume", "source"}
    assert client.get("/api/bars.json", params={"symbol": SYM, "source": "yfinance"},
                      headers=key).json()["bars"] == []
    start = j["bars"][-10]["ts"]
    assert len(client.get("/api/bars.json", params={"symbol": SYM, "start": start},
                          headers=key).json()["bars"]) == 10


def test_symbols_track_and_untrack(client, key):
    r = client.post("/api/symbols/track", json={"symbol": "xyz", "bootstrap": False}, headers=key)
    assert r.status_code == 200 and r.json() == {"tracked": "XYZ"}
    assert "XYZ" in client.get("/api/coverage", headers=key).json()["tracked"]
    r = client.delete("/api/symbols/xyz", headers=key)
    assert r.json() == {"untracked": "XYZ", "note": "cached data kept"}
    assert "XYZ" not in client.get("/api/coverage", headers=key).json()["tracked"]
    assert client.post("/api/symbols/track", json={}, headers=key).status_code == 400


# ---------------------------------------------------------------- public bars

@pytest.fixture
def no_yfinance(monkeypatch):
    """Any attempt to hit yfinance from the public endpoint raises (offline)."""
    import quant.public as pub
    calls = []

    def boom(sym, period="10y"):
        calls.append((sym, period))
        raise RuntimeError("offline")
    monkeypatch.setattr(pub, "task_backfill_bars", boom)
    return calls


def test_public_bars_headers_and_shape(client, no_yfinance):
    r = client.get("/api/public/bars", params={"symbol": "nvda"}, headers={"x-forwarded-for": "10.0.0.2"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "*"
    assert r.headers["cache-control"] == "public, max-age=1800"
    j = r.json()
    assert j["symbol"] == SYM and j["fetched"] is False
    assert len(j["bars"]) == N_BARS
    b = j["bars"][-1]
    assert len(b) == 6 and len(b[0]) == 10 and isinstance(b[5], int)

    o = client.options("/api/public/bars")
    assert o.status_code == 204
    assert o.headers["access-control-allow-origin"] == "*"
    assert o.headers["access-control-allow-methods"] == "GET, OPTIONS"
    assert o.headers["access-control-max-age"] == "86400"


def test_public_bars_alias_and_missing(client, no_yfinance):
    r = client.get("/api/public/bars", params={"symbol": "spx"}, headers={"x-forwarded-for": "10.0.0.3"})
    assert r.status_code == 404
    assert r.json()["error"].startswith("no data")
    assert r.headers["access-control-allow-origin"] == "*"
    assert no_yfinance[-1] == ("^GSPC", "3y")   # alias resolved, pull attempted once


def test_public_bars_rate_limit(client, no_yfinance):
    hdr = {"x-forwarded-for": "10.0.0.4, 1.2.3.4"}
    codes = [client.get("/api/public/bars", params={"symbol": SYM}, headers=hdr).status_code
             for _ in range(12)]
    assert codes[:10] == [200] * 10
    assert codes[10] == 429 and codes[11] == 429


# ---------------------------------------------------------------- backtests (subprocess runner)

def test_backtest_sma_cross(client, key):
    r = client.post("/api/backtest", json={"symbol": SYM, "strategy": "sma_cross"}, headers=key)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "done" and len(j["id"]) == 12
    st = j["stats"]
    assert set(st) == {"initial_cash", "final_value", "total_return", "cagr", "sharpe",
                       "max_drawdown_pct", "trades_closed", "win_rate", "bars", "range"}
    assert st["bars"] == N_BARS and st["initial_cash"] == 100000.0

    lst = client.get("/api/backtests.json", headers=key).json()["backtests"]
    assert lst[0]["id"] == j["id"] and lst[0]["status"] == "done"
    assert lst[0]["name"] == f"{SYM} sma_cross"
    one = client.get(f"/api/backtest/{j['id']}.json", headers=key).json()
    assert one["stats"] == st and isinstance(one["equity"], list) and one["spec"]["symbol"] == SYM
    assert client.get("/api/backtest/nope.json", headers=key).status_code == 404


def test_backtest_dca_cashflow_mode(client, key):
    r = client.post("/api/backtest", json={"symbol": SYM, "strategy": "dca_dip",
                                           "params": {"mode": "dca", "monthly": 500}}, headers=key)
    assert r.status_code == 200, r.text
    st = r.json()["stats"]
    assert st["mode"] == "cashflow" and st["trades_closed"] >= 1
    assert st["total_contributed"] > 100000


def test_backtest_errors(client, key):
    assert client.post("/api/backtest", json={}, headers=key).status_code == 400
    r = client.post("/api/backtest", json={"symbol": "NOPE"}, headers=key)
    assert r.status_code == 400 and "only 0 bars" in r.json()["error"]
    r = client.post("/api/backtest", json={"symbol": SYM, "strategy": "nope"}, headers=key)
    assert r.status_code == 422
    assert r.json()["status"] == "failed" and "unknown strategy" in r.json()["error"]


def test_runner_mode_imports_nothing_heavy():
    code = ("import sys; sys.argv=['main.py']; import quant.backtest; "
            "bad=[m for m in ('duckdb','fastapi','yfinance','apscheduler') if m in sys.modules]; "
            "assert not bad, bad; print('clean')")
    p = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    assert p.stdout.strip() == "clean"


# ---------------------------------------------------------------- /api/run

def test_run_snapshot(client, key):
    code = ("import os, duckdb; c = duckdb.connect(os.environ['QDB'], read_only=True); "
            "print(c.execute('select count(*) from bars').fetchone()[0])")
    r = client.post("/api/run", json={"code": code, "timeout": 60}, headers=key)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["returncode"] == 0, j["stderr"]
    assert j["stdout"].strip() == str(N_BARS)
    assert client.post("/api/run", json={}, headers=key).status_code == 400


# ---------------------------------------------------------------- signals + mail

class _FakeSMTP:
    sent = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def login(self, user, pw):
        self.login_args = (user, pw)

    def send_message(self, msg, from_addr=None, to_addrs=None):
        _FakeSMTP.sent.append({"host": self.host, "port": self.port, "login": self.login_args,
                               "from": from_addr, "to": to_addrs, "msg": msg})


def test_signals_and_mail(client, key, monkeypatch):
    sc = client.get("/api/signals", headers=key).json()
    assert set(sc) == {"date", "fired", "watch", "gauges", "rule"}

    dry = client.post("/api/tasks/signal_mail", json={"dry": True}, headers=key).json()
    assert dry["dry"] is True and dry["to"] == ["ops@example.test", "second@example.test"]
    assert set(dry["scan"]) == set(sc)

    import quant.mail as mail
    monkeypatch.setattr(mail.smtplib, "SMTP_SSL", _FakeSMTP)
    r = client.post("/api/tasks/signal_mail", json={"subject": "测试主题"}, headers=key)
    assert r.status_code == 200, r.text
    assert r.json()["sent"] == {"to": ["ops@example.test", "second@example.test"], "ok": True}
    s = _FakeSMTP.sent[-1]
    assert (s["host"], s["port"]) == ("smtp.example.test", 465)
    assert s["login"] == ("lyra@example.test", "secret")
    assert s["from"] == "lyra@example.test" and s["to"] == ["ops@example.test", "second@example.test"]
    msg = s["msg"]
    assert msg["Subject"] == "测试主题"
    parts = {p.get_content_type() for p in msg.iter_parts()}
    assert parts == {"text/plain", "text/html"}
    assert "加仓信号" in msg.get_body(("html",)).get_content()


def test_mail_not_configured_raises(monkeypatch):
    import quant.mail as mail
    monkeypatch.setattr(mail, "MAIL_TO", [])
    assert mail.mail_ready() is False
    with pytest.raises(RuntimeError, match="mail channel not configured"):
        mail.send_mail("x", "<p>y</p>")


def test_scheduler_times_unchanged():
    """Cron triggers are the same three as before; AUTO_JOBS=0 keeps it off in tests."""
    import quant.jobs as jobs
    assert jobs.start_scheduler() is False and not jobs.sched.running
    src = open(os.path.join(ROOT, "quant", "jobs.py"), encoding="utf-8").read()
    assert 'day_of_week="mon-fri", hour=21, minute=15' in src
    assert 'day_of_week="sun", hour=3, minute=0' in src
    assert 'day_of_week="tue-sat", hour=10, minute=0' in src
