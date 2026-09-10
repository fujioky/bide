"""services.market_meta + routers.market 的行为测试。agent 用 httpx.MockTransport 假掉。

运行：cd app && uv run --with-requirements requirements.txt --with pytest --with pytest-asyncio pytest tests/test_market.py -q
"""
import asyncio
import json
import os
import tempfile
from datetime import datetime, timezone

_TMP = tempfile.mkdtemp(prefix="bide-market-")
os.environ.update({"DATA_DIR": _TMP, "DEV_LOGIN": "1", "AGENT_URL": "http://agent.test", "AGENT_SECRET": "x", "BASE_URL": "http://t", "SESSION_SECRET": "test-secret"})

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import select  # noqa: E402

from bide.db import Base, SessionLocal, engine  # noqa: E402
from bide.main import app  # noqa: E402
from bide.models import KV, MarketMeta, User, UserList  # noqa: E402
from bide.routers import market as market_router  # noqa: E402
from bide.services import market_meta as M  # noqa: E402

svc = M.svc

# ── 假 agent：按 prompt 开头判断是哪个 job，把代码从第一行抠出来，回固定数据 ──

FAKE = {
    "NVDA": {
        "names": {"zh": "英伟达", "en": "NVIDIA Corporation", "kind": "stock", "under": "", "lev": ""},
        "analyst": {"n": 50, "buy": 45, "hold": 5, "sell": 0, "low": 100, "mean": 200.5, "high": 300, "src": "x", "asof": "2026-09-01"},
        "tags": {"tags": ["AI算力", "不存在的标签"], "note": ""},
        "earnings": {"date": "2026-11-19", "when": "盘后", "fy": 2027, "fq": 3, "confirmed": True, "src": "x", "asof": "2026-09-01"},
    },
    "TQQQ": {"names": {"zh": "随便写", "en": "ProShares UltraPro QQQ", "kind": "etf", "under": "QQQ", "lev": "3倍做多"}},
    "QQQ": {"names": {"zh": "纳指100 ETF", "en": "Invesco QQQ Trust", "kind": "etf", "under": "", "lev": ""},
            "tags": {"tags": ["宽基指数"], "note": ""}},
    "XYZ": {"tags": {"tags": ["生物医药"], "note": "药企"}},
}
CALLS: list[dict] = []


def _job_of(prompt: str) -> str:
    if prompt.startswith("查这些美股代码"):
        return "names"
    if prompt.startswith("联网查这些美股当前的华尔街分析师一致预期"):
        return "analyst"
    if prompt.startswith("给这些美股打投资主题标签"):
        return "tags"
    if prompt.startswith("联网查这些美股「下一次」财报披露的日期"):
        return "earnings"
    raise AssertionError("未知 prompt: " + prompt[:30])


def _syms_of(prompt: str) -> list[str]:
    return [s.strip() for s in prompt.split("\n", 1)[0].split("：", 1)[1].split(",")]


def _default(job: str, s: str) -> dict:
    return {
        "names": {"zh": s, "en": "", "kind": "stock", "under": "", "lev": ""},
        "analyst": {"n": 0},
        "tags": {"tags": [], "note": "未知"},
        "earnings": {"date": None},
    }[job]


def fake_agent(req: httpx.Request) -> httpx.Response:
    assert req.url == "http://agent.test/json"
    assert req.headers["x-agent-secret"] == "x"
    body = json.loads(req.content)
    job, syms = _job_of(body["prompt"]), _syms_of(body["prompt"])
    CALLS.append({"job": job, "syms": syms, "maxTurns": body["maxTurns"], "prompt": body["prompt"]})
    arr = [{"sym": s, **(FAKE.get(s, {}).get(job) or _default(job, s))} for s in syms]
    return httpx.Response(200, json={"ok": True, "json": arr})


# ── 夹具 ──

@pytest.fixture(autouse=True)
def fresh_state():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    for d in (svc.NAMES, svc.ANA, svc.TAGS, svc.EARN, svc.ST, svc.qn, svc.qa, svc.qt, svc.qe, svc.TRIED):
        d.clear()
    svc.clients.clear()
    svc.running, svc.last_err, svc.loaded = False, "", False
    svc._loop_task = None
    svc.http = httpx.AsyncClient(transport=httpx.MockTransport(fake_agent))
    CALLS.clear()
    yield


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def admin(c: httpx.AsyncClient) -> None:
    r = await c.get("/auth/dev", params={"email": "a@b.c", "admin": 1})
    assert r.status_code == 302


def rows(kind: str) -> dict:
    db = SessionLocal()
    try:
        return {r.sym: r.data for r in db.scalars(select(MarketMeta).where(MarketMeta.kind == kind))}
    finally:
        db.close()


# ── ① 未知标的：先 pending 并入队，跑一轮后落表、不再 pending ──

@pytest.mark.asyncio
async def test_meta_pending_then_filled(client):
    r = await client.get("/api/market/meta", params={"syms": "nvda, NVDA,bad sym,"})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    j = r.json()
    assert set(j) == {"names", "analyst", "tags", "earnings", "tagSet", "pending", "ready", "ts"}
    assert j["ready"] is True and j["pending"] == ["NVDA"] and j["names"] == {}
    assert j["tagSet"] == M.TAG_SET
    assert list(svc.qn) == ["NVDA"] and list(svc.qa) == ["NVDA"] and list(svc.qt) == ["NVDA"] and list(svc.qe) == ["NVDA"]

    await svc.drain()
    assert [c["job"] for c in CALLS] == ["names", "tags", "earnings", "analyst"]   # 名字优先，分析师最后
    assert [c["maxTurns"] for c in CALLS] == [24, 30, 40, 40]
    assert rows("names")["NVDA"]["zh"] == "英伟达"
    assert rows("analyst")["NVDA"]["mean"] == 200.5 and rows("analyst")["NVDA"]["n"] == 50
    assert rows("tags")["NVDA"]["tags"] == ["AI算力"]        # 不在 TAG_SET 里的被过滤掉
    assert rows("earnings")["NVDA"]["date"] == "2026-11-19" and rows("earnings")["NVDA"]["confirmed"] is True

    r = await client.get("/api/market/meta", params={"syms": "NVDA"})
    j = r.json()
    assert j["pending"] == [] and not svc.qn and not svc.qa
    assert j["names"]["NVDA"]["en"] == "NVIDIA Corporation"
    assert j["analyst"]["NVDA"]["buy"] == 45 and j["tags"]["NVDA"]["auto"] == 1
    assert j["earnings"]["NVDA"]["when"] == "盘后"


@pytest.mark.asyncio
async def test_meta_reloads_cache_from_table(client):
    """内存是空的、表里有：第一次请求从表加载，不重复排队。"""
    db = SessionLocal()
    db.add(MarketMeta(kind="names", sym="AAPL", data={"zh": "苹果", "en": "Apple", "kind": "stock", "under": "", "lev": "", "at": 1}))
    db.add(MarketMeta(kind="analyst", sym="AAPL", data={"none": 1, "at": 1}))
    db.commit(); db.close()
    j = (await client.get("/api/market/meta", params={"syms": "AAPL"})).json()
    assert j["names"]["AAPL"]["zh"] == "苹果"
    assert "AAPL" not in j["analyst"] and "AAPL" not in svc.qa       # none 记录：不返回、也不重查
    assert j["pending"] == ["AAPL"] and list(svc.qt) == ["AAPL"]      # 只缺 tags / earnings


# ── ② 杠杆 ETF：zh 由服务端拼，正股入队 ──

@pytest.mark.asyncio
async def test_leveraged_etf_maps_to_underlying():
    svc.loaded = True
    await svc.job_names(["TQQQ"])
    rec = svc.NAMES["TQQQ"]
    assert rec["zh"] == "QQQ 3倍做多ETF" and rec["under"] == "QQQ" and rec["kind"] == "etf"
    assert rows("names")["TQQQ"]["zh"] == "QQQ 3倍做多ETF"
    assert "QQQ" in svc.qn and "QQQ" in svc.qa          # 正股：名字要查，分析师也先按可覆盖排上
    assert svc.target("TQQQ") == "QQQ" and M.target("TQQQ") == "QQQ"
    assert not svc.taggable("TQQQ") and not svc.has_earnings("TQQQ")

    await svc.drain()
    assert svc.NAMES["QQQ"]["kind"] == "etf"
    assert svc.ANA["QQQ"] == {"none": 1, "at": svc.ANA["QQQ"]["at"]}   # ETF 没分析师覆盖

    db = SessionLocal()
    j = M.meta_for(db, ["TQQQ"])
    db.close()
    assert j["names"]["TQQQ"]["zh"] == "QQQ 3倍做多ETF"
    assert "QQQ" not in j["analyst"] and "QQQ" not in svc.qa          # kind=etf 不可覆盖，不再排
    assert j["pending"] == ["QQQ"] and list(svc.qt) == ["QQQ"]        # 杠杆 ETF 显示正股的标签
    assert not svc.qe                                                 # ETF 没财报


# ── ③ tags 过滤后为空 → nofit ──

@pytest.mark.asyncio
async def test_tags_nofit():
    svc.loaded = True
    await svc.job_tags(["XYZ"])
    rec = svc.TAGS["XYZ"]
    assert rec["tags"] == [] and rec["nofit"] == 1 and rec["auto"] == 1 and rec["note"] == "药企"
    assert rows("tags")["XYZ"]["nofit"] == 1

    # nofit 的：meta 照旧返回，同时排队重查
    db = SessionLocal()
    j = M.meta_for(db, ["XYZ"])
    db.close()
    assert j["tags"]["XYZ"]["nofit"] == 1 and "XYZ" in svc.qt and "XYZ" in j["pending"]  # name/analyst/earnings are still missing

    # 手工改过的没有 auto，refresh_all 不会覆盖；nofit 的会重排
    svc.TRIED.clear(); svc.qt.clear()
    svc.TAGS["MANUAL"] = {"tags": [], "note": "", "at": 1}
    db = SessionLocal()
    u = User(email="w@b.c"); db.add(u); db.commit()
    db.add(UserList(user_id=u.id, kind="watch", symbols=["XYZ", "MANUAL"])); db.commit()
    got = svc.refresh_all("test", db)
    db.close()
    assert got["tags"] == 1 and list(svc.qt) == ["XYZ"]


# ── ④ SSE：push 到队列 / 生成器 / 满员 503 ──

@pytest.mark.asyncio
async def test_sse_push_and_stream(client):
    q: asyncio.Queue = asyncio.Queue()
    svc.clients.add(q)
    gen = market_router.sse_gen(q)
    assert await gen.__anext__() == "retry: 20000\n\n"
    svc.push({"names": {"NVDA": {"zh": "英伟达"}}})
    line = await asyncio.wait_for(gen.__anext__(), 1)
    assert line == 'data: {"names":{"NVDA":{"zh":"英伟达"}}}\n\n'
    await gen.aclose()
    assert q not in svc.clients                                       # 断开时清理

    for _ in range(40):
        svc.clients.add(asyncio.Queue())
    r = await client.get("/api/market/stream")
    assert r.status_code == 503 and r.json() == {"error": "连接数已满"}


@pytest.mark.asyncio
async def test_sse_heartbeat(monkeypatch):
    monkeypatch.setattr(market_router, "HEARTBEAT_SEC", 0.05)
    q: asyncio.Queue = asyncio.Queue()
    gen = market_router.sse_gen(q)
    await gen.__anext__()
    assert await gen.__anext__() == ": hb\n\n"
    await gen.aclose()


# ── ⑤ 每日刷新只跑一次 ──

def test_daily_tick_once(monkeypatch):
    svc.loaded = True
    calls = []
    monkeypatch.setattr(svc, "refresh_all", lambda why, db=None: calls.append(why) or {})
    early = datetime(2026, 9, 10, 21, 59, tzinfo=timezone.utc)
    late = datetime(2026, 9, 10, 22, 10, tzinfo=timezone.utc)
    assert svc.tick(early) is False and calls == []
    assert svc.tick(late) is True and calls == ["daily"]
    assert svc.tick(late) is False and calls == ["daily"]
    assert svc.tick(datetime(2026, 9, 10, 23, 59, tzinfo=timezone.utc)) is False
    db = SessionLocal()
    assert db.get(KV, "market.state").value == {"lastDaily": "2026-09-10"}
    db.close()
    assert svc.state()["lastDaily"] == "2026-09-10"
    # 第二天再跑一次
    assert svc.tick(datetime(2026, 9, 11, 22, 30, tzinfo=timezone.utc)) is True and calls == ["daily", "daily"]
    # 已经有 lastDaily 的冷启动不补
    assert svc.boot() is False and calls == ["daily", "daily"]


def test_boot_runs_once_when_never_ran(monkeypatch):
    svc.loaded = True
    calls = []
    monkeypatch.setattr(svc, "refresh_all", lambda why, db=None: calls.append(why) or {})
    assert svc.boot() is True and calls == ["boot"]
    assert svc.boot() is False and calls == ["boot"]
    assert svc.ST["lastDaily"] == datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ── 管理员接口 ──

@pytest.mark.asyncio
async def test_admin_endpoints(client):
    assert (await client.get("/api/market/state")).status_code == 401
    await admin(client)
    st = (await client.get("/api/market/state")).json()
    assert st["ready"] is True and st["running"] is False and st["lastDaily"] is None
    assert st["queue"] == {"names": [], "tags": [], "earnings": [], "analyst": []}
    assert st["counts"] == {"names": 0, "analyst": 0, "tags": 0, "earnings": 0} and st["clients"] == 0

    q: asyncio.Queue = asyncio.Queue(); svc.clients.add(q)
    r = await client.put("/api/market/tags", json={"tags": {"nvda": ["核能", " 存储 ", ""], "bad sym": ["x"], "MU": {"tags": ["存储"]}}})
    j = r.json()
    assert j["ok"] is True and j["tags"]["NVDA"]["tags"] == ["核能", "存储"] and j["tags"]["MU"]["tags"] == ["存储"]
    assert "auto" not in j["tags"]["NVDA"] and rows("tags")["NVDA"]["tags"] == ["核能", "存储"]
    assert json.loads(q.get_nowait()[6:])["tags"]["MU"]["tags"] == ["存储"]

    r = await client.post("/api/market/refresh", json={"syms": ["nvda", "^IXIC"], "names": True, "analyst": True, "earnings": True, "tags": True})
    assert r.json() == {"ok": True, "queued": 2}
    assert list(svc.qn) == ["NVDA", "^IXIC"] and list(svc.qa) == ["NVDA"] and list(svc.qe) == ["NVDA"] and list(svc.qt) == ["NVDA"]
    await svc.drain()
    assert svc.NAMES["NVDA"]["zh"] == "英伟达" and svc.NAMES["^IXIC"]["zh"] == "^IXIC"

    # 全量：关注列表并集
    db = SessionLocal()
    u = db.scalar(select(User).where(User.email == "a@b.c"))
    db.add(UserList(user_id=u.id, kind="watch", symbols=["NVDA", "AMD"])); db.commit(); db.close()
    r = await client.post("/api/market/refresh", json={})
    j = r.json()
    assert j["ok"] is True and j["watched"] == 2 and j["names"] == 1 and j["tags"] == 1 and j["earnings"] == 1
    assert j["analyst"] == 1 and list(svc.qa) == ["AMD"]         # NVDA 半天内刚查过，不重复


@pytest.mark.asyncio
async def test_agent_failure_sets_last_err():
    svc.loaded = True
    svc.http = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"ok": False, "err": "grok 挂了"})))
    await svc.job_names(["NVDA"])
    assert svc.NAMES == {} and svc.last_err == "grok 挂了"
    svc.http = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(502)))
    await svc.job_names(["NVDA"])
    assert svc.last_err == "agent 502"


def test_import_legacy():
    db = SessionLocal()
    got = M.import_legacy(db, {"nvda": {"zh": "英伟达", "at": 1}}, {"NVDA": {"n": 3, "at": 1}}, {"NVDA": {"tags": ["AI算力"], "at": 1}},
                          {"NVDA": {"none": 1, "at": 1}}, {"lastDaily": "2026-09-01"})
    assert got == {"names": 1, "analyst": 1, "tags": 1, "earnings": 1, "state": 1}
    assert db.get(KV, "market.state").value == {"lastDaily": "2026-09-01"}
    svc.load(db)
    db.close()
    assert svc.NAMES["NVDA"]["zh"] == "英伟达" and svc.ST == {"lastDaily": "2026-09-01"}
    assert svc.state()["counts"] == {"names": 1, "analyst": 1, "tags": 1, "earnings": 1}


@pytest.mark.asyncio
async def test_prompts_verbatim():
    """四个 prompt 与 blog/market-meta.js 里的模板逐字一致（把 ${...} 换成同样的拼接结果后比对）。"""
    import re
    src = open(os.path.join(os.path.dirname(__file__), "..", "..", "blog", "market-meta.js"), encoding="utf-8").read()
    js = re.findall(r"const prompt = `(.*?)`;", src, re.S)
    assert len(js) == 4
    svc.loaded = True
    syms = ["AAA", "BBB"]
    for fn in (svc.job_names, svc.job_analyst, svc.job_tags, svc.job_earnings):
        await fn(list(syms))
    assert [c["job"] for c in CALLS] == ["names", "analyst", "tags", "earnings"]
    for j, c in zip(js, CALLS):
        want = j.replace("${syms.join(', ')}", ", ".join(syms)).replace("${TAG_SET.join('、')}", "、".join(M.TAG_SET))
        assert c["prompt"] == want
