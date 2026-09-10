"""Bitget 模块（services.bitget + routers.bitget）测试。

上游用 httpx.MockTransport 假装；签名与保险箱的期望值是用本机 node 的 crypto 算出来
写死的（见 REF），保证与旧 blog/bitget.js 逐字节一致——尤其是 scrypt 派生的密钥，
旧系统迁过来的 vault.json 密文必须能解开。

运行：cd app && uv run --with-requirements requirements.txt --with pytest --with pytest-asyncio \
        pytest tests/test_bitget.py -q
"""
import dataclasses
import json
import os
import tempfile

# 环境变量必须在 import bide 之前设好：settings 是模块级常量。
_TMP = tempfile.mkdtemp(prefix="bide-bg-test-")
os.environ.update({
    "DEV_LOGIN": "1",
    "DATA_DIR": _TMP,
    "DATABASE_URL": "",
    "BASE_URL": "http://testserver",       # https 会让 cookie 带 secure，TestClient 就不回传了
    "SESSION_SECRET": "unit-test-session",
    "BITGET_KEY": "test-key-trade",
    "BITGET_SECRET": "test-secret-trade",
    "BITGET_RO_KEY": "test-key-ro",
    "BITGET_RO_SECRET": "test-secret-ro",
    "BG_VAULT_SECRET": "unit-test-vault-secret",
    "BG_MAX_ORDER_USD": "60",
    "ADMIN_EMAILS": "",
    "SMTP_USER": "", "NOTIFY_TO": "",
})

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from bide.db import SessionLocal, init_db  # noqa: E402
from bide.main import app  # noqa: E402
from bide.models import Audit, KV  # noqa: E402
from bide.services import bitget as bg  # noqa: E402

# node -e 的输出（见文件头）：
#   sign('test-secret-ro','1700000000000','GET','/api/v3/stockplus/market/quote?symbol=NVDA.US,AAPL.US')
#   sign('test-secret-trade','1700000000000','POST','/api/v3/stockplus/trade/place-order','{"symbol":"NVDA.US","orderType":"LO"}')
#   scryptSync('unit-test-vault-secret','lyra-bg-vault-v1',32).toString('hex')
#   aes-256-gcm 用该 key、iv=000102…0b 加密 'legacy-pass-φ' 得到的条目
REF = {
    "sigGet": "2rqLibhkEGQctU1oiLge7Bwee3jbF93OBAar3VnO1/s=",
    "sigPost": "EU90/uzaFNGCh7MfFv6WwmysXZDNpRKieO3nD0kzDIw=",
    "keyHex": "cb63a0b68390ac584b113ac4eb78077445c2f977832e5389e0fd9301a99a34a8",
    "entry": {"v": 1, "slot": "ro", "at": "2025-01-02T03:04:05.000Z",
              "iv": "AAECAwQFBgcICQoL", "tag": "6HJlaXy03ojcA1PrfXyK9w==", "ct": "lOZIR9+sEObQwrQYj2I="},
    "legacyPlain": "legacy-pass-φ",
}

QUOTE_PATH = "/api/v3/stockplus/market/quote"
CANDLE_PATH = "/api/v3/stockplus/market/candlestick"
ORDER_PATH = "/api/v3/stockplus/trade/place-order"
CANCEL_PATH = "/api/v3/stockplus/trade/cancel-order"


# ── 夹具 ────────────────────────────────────────────────────

class Upstream:
    """假 Bitget：按路径给回应，同时把收到的请求记下来。"""

    def __init__(self):
        self.routes: dict[str, dict] = {}
        self.calls: list[httpx.Request] = []

    def handler(self, req: httpx.Request) -> httpx.Response:
        self.calls.append(req)
        r = self.routes.get(req.url.path)
        if r is None:
            return httpx.Response(404, json={"code": "40404", "msg": "no route"})
        if callable(r):
            return r(req)
        return httpx.Response(200, json=r)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler), timeout=20.0)


@pytest.fixture(scope="session", autouse=True)
def _tables():
    init_db()


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture(autouse=True)
def _clean(db):
    """每个用例从空保险箱、空缓存、空审计开始。"""
    for key in (bg.KV_VAULT, bg.KV_LAST):
        row = db.get(KV, key)
        if row:
            db.delete(row)
    for a in db.scalars(select(Audit)).all():
        db.delete(a)
    db.commit()
    bg._QCACHE.clear()
    bg._CCACHE.clear()
    bg._q_inflight = None
    yield


@pytest.fixture
def upstream(monkeypatch):
    up = Upstream()
    c = up.client()
    monkeypatch.setattr(bg, "get_client", lambda: c)
    yield up


def _login(c: TestClient, email: str, admin: bool):
    r = c.get(f"/auth/dev?email={email}&admin={1 if admin else 0}", follow_redirects=False)
    assert r.status_code == 302


@pytest.fixture
def admin():
    with TestClient(app) as c:
        _login(c, "admin@test.local", True)
        yield c


@pytest.fixture
def user():
    with TestClient(app) as c:
        _login(c, "user@test.local", False)
        yield c


@pytest.fixture
def anon():
    with TestClient(app) as c:
        yield c


def audits(db) -> list[dict]:
    db.expire_all()
    return [a.rec for a in db.scalars(select(Audit).order_by(Audit.id)).all()]


# ── 签名 ────────────────────────────────────────────────────

def test_sign_matches_node():
    assert bg.sign("test-secret-ro", "1700000000000", "GET",
                   "/api/v3/stockplus/market/quote?symbol=NVDA.US,AAPL.US") == REF["sigGet"]
    assert bg.sign("test-secret-trade", "1700000000000", "post",
                   "/api/v3/stockplus/trade/place-order", '{"symbol":"NVDA.US","orderType":"LO"}') == REF["sigPost"]


def test_query_keeps_bare_commas():
    assert bg.build_query({"symbol": "NVDA.US,AAPL.US", "n": 1.0, "skip": "", "none": None, "a": ["x y", "z"]}) \
        == "symbol=NVDA.US,AAPL.US&n=1&a=x%20y&a=z"


# ── 保险箱 ──────────────────────────────────────────────────

def test_vault_key_and_legacy_ciphertext(db):
    assert bg.vkey().hex() == REF["keyHex"]
    bg.import_legacy_vault(db, {"ro": REF["entry"]})
    assert db.get(KV, bg.KV_VAULT).value == {"ro": REF["entry"]}
    assert bg.vault_get(db, "ro") == REF["legacyPlain"]


def test_vault_roundtrip(db):
    bg.vault_put(db, "ro", "pass-ro")
    bg.vault_put(db, "trade", "pass-trade")
    assert bg.vault_get(db, "ro") == "pass-ro"
    assert bg.vault_get(db, "trade") == "pass-trade"
    e = db.get(KV, bg.KV_VAULT).value["trade"]
    assert set(e) == {"v", "slot", "at", "iv", "tag", "ct"} and e["v"] == 1 and e["slot"] == "trade"
    assert e["at"].endswith("Z")
    st = bg.vault_status(db)
    assert st["hasVaultSecret"] is True
    assert st["slots"]["ro"]["readable"] and st["slots"]["ro"]["leftMin"] is None and st["slots"]["ro"]["ttlHours"] is None
    assert st["slots"]["trade"]["ttlHours"] == 12 and 719 <= st["slots"]["trade"]["leftMin"] <= 720
    bg.vault_delete(db, "ro")
    assert bg.vault_get(db, "ro") is None and bg.vault_get(db, "trade") == "pass-trade"
    bg.vault_delete(db, "trade")
    assert db.get(KV, bg.KV_VAULT) is None


def test_vault_wrong_secret_reads_nothing(db, monkeypatch):
    bg.vault_put(db, "ro", "pass-ro")
    monkeypatch.setattr(bg, "settings", dataclasses.replace(bg.settings, bg_vault_secret="another-secret"))
    assert bg.vault_get(db, "ro") is None
    st = bg.vault_status(db)
    assert st["slots"]["ro"]["saved"] is True and st["slots"]["ro"]["readable"] is False
    monkeypatch.setattr(bg, "settings", dataclasses.replace(bg.settings, bg_vault_secret=""))
    assert bg.vault_get(db, "ro") is None and bg.vault_status(db)["hasVaultSecret"] is False


def test_vault_trade_expires_after_12h(db, monkeypatch):
    bg.vault_put(db, "ro", "pass-ro")
    bg.vault_put(db, "trade", "pass-trade")
    t0 = bg._now_ms()
    monkeypatch.setattr(bg, "_now_ms", lambda: t0 + 11 * 3600_000)
    assert bg.vault_get(db, "trade") == "pass-trade"
    monkeypatch.setattr(bg, "_now_ms", lambda: t0 + 12 * 3600_000 + 1000)
    assert bg.vault_get(db, "trade") is None
    assert bg.vault_get(db, "ro") == "pass-ro"          # ro 不过期
    st = bg.vault_status(db)["slots"]
    assert st["trade"] == {**st["trade"], "saved": True, "expired": True, "leftMin": 0, "readable": False}
    assert st["ro"]["expired"] is False and st["ro"]["readable"] is True


def test_vault_http(admin, db):
    r = admin.post("/api/bg/vault", json={"slot": "trade", "passphrase": "abc"})
    assert r.status_code == 200 and r.json() == {"ok": True, "slot": "trade"}
    assert admin.post("/api/bg/vault", json={"slot": "ro"}).status_code == 400
    assert admin.post("/api/bg/vault", json={"passphrase": "x" * 257}).json() == {"error": "passphrase 过长"}
    j = admin.get("/api/bg/vault").json()
    assert j["slots"]["trade"]["saved"] is True and j["slots"]["ro"] == {"saved": False, "ttlHours": None}
    assert bg.vault_get(db, "trade") == "abc"
    assert admin.delete("/api/bg/vault?slot=trade").json() == {"ok": True, "slot": "trade"}
    assert admin.get("/api/bg/vault").json()["slots"]["trade"] == {"saved": False, "ttlHours": 12}


# ── 权限 ────────────────────────────────────────────────────

def test_probe_forbidden_for_non_admin(user):
    r = user.post("/api/bg/probe", json={"path": QUOTE_PATH})
    assert r.status_code == 403 and r.json() == {"error": "仅管理员"}
    for p in ("/api/bg/vault", "/api/bg/last", "/api/bg/order/log", "/api/bg/egress"):
        assert user.get(p).status_code == 403
    assert user.post("/api/bg/order", json={}).status_code == 403
    assert user.get("/bg/setup").status_code == 403


def test_quote_requires_login(anon):
    r = anon.get("/api/bg/quote?syms=NVDA")
    assert r.status_code == 401 and r.json() == {"error": "需要登录"}
    assert anon.get("/api/bg/candles?sym=NVDA").status_code == 401
    assert anon.post("/api/bg/probe", json={"path": QUOTE_PATH}).status_code == 401


# ── 行情 ────────────────────────────────────────────────────

def _quote_payload():
    return {"code": "00000", "msg": "success", "data": {"list": [{
        "symbol": "NVDA.US", "lastDone": "100.00", "timestamp": "2026-09-09T20:00:00Z",
        "open": "98", "high": "101", "low": "97", "volume": "12345", "prevClose": "95.00", "tradeStatus": "Normal",
        # 盘前还没成交：lastDone 0、时间戳却最新——必须被过滤掉
        "preMarketQuote": {"lastDone": 0, "timestamp": "2026-09-10T08:00:00Z", "prevClose": "102.00"},
        # 盘后有成交：基准要取它自己的 prevClose（100），不是顶层的 95
        "postMarketQuote": {"lastDone": "102.00", "timestamp": "2026-09-09T23:30:00Z", "high": "103",
                            "low": "101", "volume": "500", "prevClose": "100.00"},
        "overnightQuote": None,
    }]}}


def test_quote_session_selection(user, db, upstream):
    bg.vault_put(db, "ro", "pass-ro")
    upstream.routes[QUOTE_PATH] = _quote_payload()

    r = user.get("/api/bg/quote?syms=nvda, aapl,NVDA,bad$")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    j = r.json()
    assert set(j) == {"at", "maxAgeSec", "quotes"} and set(j["quotes"]) == {"NVDA", "AAPL"}
    assert j["quotes"]["AAPL"] is None
    q = j["quotes"]["NVDA"]
    assert q["session"] == "post" and q["last"] == "102.00" and q["ts"] == "2026-09-09T23:30:00Z"
    assert q["prevClose"] == "100.00" and q["chgPct"] == 2.0
    assert q["close"] == "100.00" and q["closeTs"] == "2026-09-09T20:00:00Z" and q["status"] == "Normal"
    assert q["pre"] == {"last": 0, "ts": "2026-09-10T08:00:00Z", "high": None, "low": None, "vol": None, "prev": "102.00"}
    assert q["post"]["last"] == "102.00" and q["on"] is None
    assert q["ageSec"] > 0 and j["maxAgeSec"] == q["ageSec"] and q["cachedSec"] == 0

    # 上游请求：裸逗号、正确的签名头、只读 key
    assert len(upstream.calls) == 1
    req = upstream.calls[0]
    assert str(req.url) == "https://api.bitget.com" + QUOTE_PATH + "?symbol=NVDA.US,AAPL.US"
    assert req.headers["ACCESS-KEY"] == "test-key-ro" and req.headers["ACCESS-PASSPHRASE"] == "pass-ro"
    full = QUOTE_PATH + "?symbol=NVDA.US,AAPL.US"
    assert req.headers["ACCESS-SIGN"] == bg.sign("test-secret-ro", req.headers["ACCESS-TIMESTAMP"], "GET", full)

    # 60 秒内再拉：命中缓存，不打上游；没回的 AAPL 也占了位
    r2 = user.get("/api/bg/quote?syms=NVDA,AAPL")
    assert r2.status_code == 200 and len(upstream.calls) == 1
    assert r2.json()["quotes"]["AAPL"] is None


def test_quote_regular_when_newest(user, db, upstream):
    bg.vault_put(db, "ro", "pass-ro")
    p = _quote_payload()
    p["data"]["list"][0]["postMarketQuote"]["timestamp"] = "2026-09-09T10:00:00Z"
    upstream.routes[QUOTE_PATH] = p
    q = user.get("/api/bg/quote?syms=NVDA").json()["quotes"]["NVDA"]
    assert q["session"] == "regular" and q["last"] == "100.00" and q["prevClose"] == "95.00"
    assert q["chgPct"] == 5.26


def test_quote_errors(user, db, upstream):
    assert user.get("/api/bg/quote").json() == {"error": "缺 syms"}
    assert user.get("/api/bg/quote?syms=$$,1abc").json() == {"error": "syms 里没有合法代码"}
    r = user.get("/api/bg/quote?syms=NVDA")           # 保险箱里没有 ro
    assert r.status_code == 502 and r.json() == {"error": bg.NO_RO_PASS}
    bg.vault_put(db, "ro", "pass-ro")
    upstream.routes[QUOTE_PATH] = {"code": "40018", "msg": "Invalid IP"}
    r = user.get("/api/bg/quote?syms=NVDA")
    assert r.status_code == 502 and r.json() == {"error": "40018 Invalid IP"}
    assert bg._q_inflight is None


@pytest.mark.asyncio
async def test_quotes_pure_entry(db, upstream):
    """给 MCP 用的纯函数入口，不经 HTTP。"""
    bg.vault_put(db, "ro", "pass-ro")
    upstream.routes[QUOTE_PATH] = _quote_payload()
    out = await bg.quotes(db, ["nvda"])
    assert out["quotes"]["NVDA"]["session"] == "post"
    with pytest.raises(bg.BgError) as ei:
        await bg.quotes(db, ["x" * 20])
    assert ei.value.status == 400


# ── K 线 ────────────────────────────────────────────────────

def test_candles(user, db, upstream):
    bg.vault_put(db, "ro", "pass-ro")
    upstream.routes[CANDLE_PATH] = {"code": "00000", "data": {"list": [
        {"timestamp": "2026-09-09T13:32:00Z", "open": "1", "high": "2", "low": "0.5", "close": "1.5",
         "volume": "100", "turnover": "150", "tradeSession": "Intraday"},
        {"timestamp": "2026-09-09T13:30:00Z", "open": "1", "high": "1", "low": "1", "close": "1",
         "volume": "10", "turnover": "10", "tradeSession": "Pre"},
        {"timestamp": 1757376000, "open": "1", "high": "1", "low": "1", "close": "1",     # 日线是秒
         "volume": "10", "turnover": "10", "tradeSession": "Post"},
        {"timestamp": "garbage", "open": "1"},
    ]}}
    r = user.get("/api/bg/candles?sym=nvda&period=Min_5&count=abc")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    j = r.json()
    assert j["sym"] == "NVDA" and j["period"] == "Min_5" and j["cachedSec"] == 0
    assert j["bars"] == [
        [1757376000000, 1, 1, 1, 1, 10, "o", 10],
        [1788960600000, 1, 1, 1, 1, 10, "p", 10],
        [1788960720000, 1, 2, 0.5, 1.5, 100, "r", 150],
    ]
    req = upstream.calls[0]
    full = CANDLE_PATH + "?symbol=NVDA.US&period=Min_5&count=1000&adjustType=NoAdjust&tradeSessions=All"
    assert str(req.url) == "https://api.bitget.com" + full
    assert req.headers["ACCESS-SIGN"] == bg.sign("test-secret-ro", req.headers["ACCESS-TIMESTAMP"], "GET", full)
    # 缓存
    assert user.get("/api/bg/candles?sym=NVDA&period=Min_5").json()["bars"] == j["bars"] and len(upstream.calls) == 1
    # 参数规整：period 不认识回落 Min_2，count 夹到 [10,1000]
    user.get("/api/bg/candles?sym=NVDA&period=Hour&count=5")
    assert upstream.calls[-1].url.params["period"] == "Min_2" and upstream.calls[-1].url.params["count"] == "10"
    assert user.get("/api/bg/candles?sym=1").json() == {"error": "sym 不合法"}


def test_candles_without_ro_pass(user, upstream):
    r = user.get("/api/bg/candles?sym=NVDA")
    assert r.status_code == 400 and r.json() == {"error": bg.NO_RO_PASS}


# ── 探测 ────────────────────────────────────────────────────

def test_probe_and_last(admin, db, upstream):
    upstream.routes[QUOTE_PATH] = {"code": "00000", "data": {"list": []}}
    assert admin.post("/api/bg/probe", json={"path": "/api/v3/spot/x"}).status_code == 400
    assert admin.post("/api/bg/probe", json={"path": bg.PREFIX + "../x"}).json() == {"error": "路径不合法"}
    r = admin.post("/api/bg/probe", json={"path": QUOTE_PATH})
    assert r.status_code == 400 and "slot=ro" in r.json()["error"]
    # 即时带入 passphrase，不落盘
    r = admin.post("/api/bg/probe", json={"path": QUOTE_PATH, "query": {"symbol": "NVDA.US,AAPL.US"},
                                          "passphrase": "once", "save": True})
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == 200 and j["keyKind"] == "ro" and j["path"] == QUOTE_PATH + "?symbol=NVDA.US,AAPL.US"
    assert j["body"]["code"] == "00000"
    assert upstream.calls[-1].headers["ACCESS-PASSPHRASE"] == "once"
    assert db.get(KV, bg.KV_VAULT) is None
    last = admin.get("/api/bg/last").json()
    assert set(last) == {QUOTE_PATH} and last[QUOTE_PATH]["status"] == 200 and "at" in last[QUOTE_PATH]
    assert admin.delete("/api/bg/last").json() == {"ok": True}
    assert admin.get("/api/bg/last").json() == {}
    # 上游连不上 → 502，body 就是 call() 的返回
    upstream.routes[QUOTE_PATH] = lambda req: (_ for _ in ()).throw(httpx.ConnectError("boom"))
    r = admin.post("/api/bg/probe", json={"path": QUOTE_PATH, "passphrase": "once"})
    assert r.status_code == 502 and r.json()["status"] == 0 and "boom" in r.json()["error"]


# ── 下单 ────────────────────────────────────────────────────

def test_order_validation_writes_audit(admin, db, upstream):
    bg.vault_put(db, "trade", "pass-trade")
    upstream.routes[ORDER_PATH] = {"code": "00000", "data": {"orderId": "1"}}
    cases = [
        ({"sym": "NVDA", "side": "buy", "qty": 1.5, "price": 10, "confirm": True}, "数量必须是 1 以上的正整数（Bitget Open API 不支持碎股）"),
        ({"sym": "NVDA", "side": "buy", "qty": 7, "price": 10, "confirm": True}, "单笔 $70.00 超过上限 $60"),
        ({"sym": "NVDA", "side": "buy", "qty": 1, "price": 10}, "缺 confirm"),
        ({"sym": "NVDA", "side": "hold", "qty": 1, "price": 10, "confirm": True}, "side 只能是 buy 或 sell"),
        ({"sym": "nv da", "side": "buy", "qty": 1, "price": 10, "confirm": True}, "代码不合法"),
        ({"sym": "NVDA", "side": "buy", "qty": 1, "price": -1, "confirm": True}, "价格不合法"),
    ]
    for body, why in cases:
        r = admin.post("/api/bg/order", json=body)
        assert r.status_code == 400 and r.json() == {"error": why}, body
    assert upstream.calls == []                      # 没有一笔到达上游
    recs = audits(db)
    assert [a["why"] for a in recs] == [c[1] for c in cases]
    assert all(a["ok"] is False for a in recs)
    assert recs[0] == {"ok": False, "why": cases[0][1], "sym": "NVDA", "side": "Buy", "qty": 1.5, "price": 10}
    log = admin.get("/api/bg/order/log").json()
    assert log["maxOrderUsd"] == 60 and [x["why"] for x in log["log"]] == [c[1] for c in reversed(cases)]
    assert all("at" in x for x in log["log"])


def test_order_success_and_cancel(admin, db, upstream):
    bg.vault_put(db, "trade", "pass-trade")
    upstream.routes[ORDER_PATH] = {"code": "00000", "msg": "success", "data": {"orderId": "9001"}}
    r = admin.post("/api/bg/order", json={"sym": "nvda", "side": "sell", "qty": 2, "price": 25.005,
                                          "confirm": True, "outsideRth": "AnyTime", "remark": "r" * 80})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "orderId": "9001", "sym": "NVDA", "side": "Sell", "qty": 2, "price": 25.0, "usd": 50.01}
    req = upstream.calls[-1]
    assert req.method == "POST" and req.url.path == ORDER_PATH and req.url.query == b""
    sent = json.loads(req.content)
    assert sent == {"symbol": "NVDA.US", "orderType": "LO", "side": "Sell", "submittedQuantity": "2",
                    "timeInForce": "Day", "submittedPrice": "25.00", "outsideRth": "AnyTime", "remark": "r" * 60}
    assert req.headers["ACCESS-KEY"] == "test-key-trade" and req.headers["ACCESS-PASSPHRASE"] == "pass-trade"
    assert req.headers["ACCESS-SIGN"] == bg.sign("test-secret-trade", req.headers["ACCESS-TIMESTAMP"], "POST",
                                                 ORDER_PATH, req.content.decode())
    a = audits(db)[-1]
    assert a["ok"] is True and a["orderId"] == "9001" and a["body"] == sent and a["code"] == "00000"

    # 上游拒单 → 502 + 审计
    upstream.routes[ORDER_PATH] = {"code": "101108", "msg": "param error"}
    r = admin.post("/api/bg/order", json={"sym": "NVDA", "side": "buy", "qty": 1, "price": 1, "confirm": True})
    assert r.status_code == 502 and r.json() == {"error": "101108 param error"}
    assert audits(db)[-1]["ok"] is False and audits(db)[-1]["code"] == "101108"

    # 撤单
    upstream.routes[CANCEL_PATH] = {"code": "00000"}
    assert admin.post("/api/bg/order/cancel", json={"sym": "NVDA", "orderId": "abc"}).json() == {"error": "orderId 不合法"}
    r = admin.post("/api/bg/order/cancel", json={"sym": "NVDA", "orderId": "9001"})
    assert r.json() == {"ok": True, "sym": "NVDA", "orderId": "9001"}
    assert json.loads(upstream.calls[-1].content) == {"symbol": "NVDA.US", "orderId": "9001"}
    assert audits(db)[-1] == {"ok": True, "act": "cancel", "sym": "NVDA", "oid": "9001", "code": "00000", "msg": None}


def test_order_needs_trade_passphrase(admin, db, upstream, monkeypatch):
    r = admin.post("/api/bg/order", json={"sym": "NVDA", "side": "buy", "qty": 1, "price": 1, "confirm": True})
    assert r.status_code == 502 and r.json() == {"error": bg.NO_TRADE_PASS}
    assert upstream.calls == [] and audits(db)[-1]["why"] == bg.NO_TRADE_PASS
    # trade 槽过期同样拒绝
    bg.vault_put(db, "trade", "pass-trade")
    t0 = bg._now_ms()
    monkeypatch.setattr(bg, "_now_ms", lambda: t0 + 13 * 3600_000)
    r = admin.post("/api/bg/order", json={"sym": "NVDA", "side": "buy", "qty": 1, "price": 1, "confirm": True})
    assert r.status_code == 502 and upstream.calls == []


# ── 页面与自检 ──────────────────────────────────────────────

def test_setup_page(admin, anon):
    r = admin.get("/bg/setup")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert "加密保存在数据库" in r.text and "/data/bg/vault.json" not in r.text and "<title>Bitget passphrase</title>" in r.text
    r = anon.get("/bg/setup")
    assert r.status_code == 403 and "/auth/login?next=/bg/setup" in r.text


def test_egress(admin, upstream):
    upstream.routes["/"] = lambda req: httpx.Response(200, text=" 1.2.3.4\n")
    j = admin.get("/api/bg/egress").json()
    assert j["ipify"] == "1.2.3.4" and j["icanhazip"] == "1.2.3.4"
    assert j == {**j, "hasKey": True, "hasSecret": True, "hasRoKey": True, "hasRoSecret": True, "hasVaultSecret": True}
