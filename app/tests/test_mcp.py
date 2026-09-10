"""MCP authorization lifecycle, cross-user isolation and read-only tools."""
import base64
import hashlib
import html
import json
import os
import re
import secrets
import sys
import tempfile
import time
from urllib.parse import parse_qs, urlencode, urlsplit

_TMP = tempfile.mkdtemp(prefix="bide-mcp-test-")
os.environ.update(DATA_DIR=_TMP, DATABASE_URL=f"sqlite:///{_TMP}/test.db", DEV_LOGIN="1",
                  SESSION_SECRET="test-secret", BASE_URL="https://bide.test", MCP_HOST="mcp.bide.example.com",
                  QUANT_BASE="http://quant.invalid", QUANT_API_KEY="k", SMTP_USER="", NOTIFY_TO="")
for _m in [m for m in sys.modules if m == "bide" or m.startswith("bide.")]:
    del sys.modules[_m]
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from bide.main import app
from bide.db import Base, SessionLocal, engine
from bide.models import User, OAuthClient, OAuthCredential, OAuthGrant, OAuthRequest, OAuthSessionGrant
from bide.routers import mcp_oauth as O
from bide.services import mcp_tools

HOST = "mcp.bide.example.com"
ISSUER = "https://bide.test"
RESOURCE = "https://" + HOST
HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures", "bars")


@pytest.fixture
def client():
    with TestClient(app, base_url=ISSUER) as c:
        with SessionLocal() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
            db.commit()
        _login_admin(c)
        mcp_tools.reset_bars_cache()
        yield c


def H(token=None, **extra):
    return {"host": HOST, **({"authorization": "Bearer " + token} if token else {}), **extra}


def _login_admin(client):
    r = client.get("/auth/dev", params={"email": "admin@example.com", "admin": 1}, follow_redirects=False)
    assert r.status_code == 302


def login(client, email):
    client.get("/auth/dev", params={"email": email}, follow_redirects=False)


def make_token(email="admin@example.com"):
    # Tool tests mint a persisted grant; lifecycle tests use only public endpoints.
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        ident = secrets.token_urlsafe(16)
        db.add(OAuthClient(id=ident, name="Test", redirects=["https://client.test/cb"], auth_method="none", created=O.now()))
        db.flush()
        grant = OAuthGrant(id=ident, client_id=ident, user_id=user.id, scope=O.SCOPE, resource=RESOURCE,
                           created=O.now(), expires=O.now()+3600)
        db.add(grant)
        db.flush()
        from bide.auth import manager
        session = db.scalar(select(manager.Session).where(manager.Session.user_id == user.id).order_by(manager.Session.created.desc()))
        db.add(OAuthSessionGrant(grant_id=grant.id, session_id=session.id))
        token = O.new_credential(db, ident, "access", 3600)
        db.commit()
        return token


def rpc(client, method, params=None, id_=1, token=None):
    msg = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        msg["params"] = params
    return client.post("/mcp", json=msg, headers=H(token or make_token()))


def call_tool(client, name, args=None):
    r = rpc(client, "tools/call", {"name": name, "arguments": args or {}})
    assert r.status_code == 200, r.text
    res = r.json()["result"]
    return res, json.loads(res["content"][0]["text"]) if not res.get("isError") else res["content"][0]["text"]


def load_bars(sym):
    with open(os.path.join(FIXTURES, sym + ".json")) as f:
        return json.load(f)


def register(client, method="none", **kwargs):
    r = client.post("/oauth/register", json={"client_name": "Claude test", "redirect_uris": ["https://client.test/cb"],
                                           "token_endpoint_auth_method": method, **kwargs})
    assert r.status_code == 201, r.text
    return r.json()


def auth_params(reg, **kwargs):
    verifier = "v" * 64
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return {"client_id": reg["client_id"], "redirect_uri": reg["redirect_uris"][0], "response_type": "code",
            "code_challenge": challenge, "code_challenge_method": "S256", "resource": RESOURCE,
            "scope": "mcp:read offline_access", "state": "state&with=unicode中文", **kwargs}


def inputs(response):
    return dict((k, html.unescape(v)) for k,v in re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)">', response.text))


def get_consent(client, reg, **kwargs):
    r = client.get("/oauth/authorize", params=auth_params(reg, **kwargs), follow_redirects=False)
    assert r.status_code == 302, r.text
    return client.get(r.headers["location"], follow_redirects=False)


def get_code(client, reg):
    consent = get_consent(client, reg)
    assert consent.status_code == 200
    r = client.post("/oauth/consent", data={**inputs(consent), "decision": "allow"}, follow_redirects=False)
    assert r.status_code == 302, r.text
    values = parse_qs(urlsplit(r.headers["location"]).query)
    assert values["state"] == [auth_params(reg)["state"]]
    assert values["iss"] == [ISSUER]
    return values["code"][0]


def exchange(client, reg, code, **kwargs):
    data = {"client_id": reg["client_id"], "grant_type": "authorization_code", "code": code,
            "code_verifier": "v" * 64, "redirect_uri": reg["redirect_uris"][0], "resource": RESOURCE, **kwargs}
    if reg["token_endpoint_auth_method"] == "client_secret_post":
        data["client_secret"] = reg["client_secret"]
    auth = (reg["client_id"],reg["client_secret"]) if reg["token_endpoint_auth_method"] == "client_secret_basic" else None
    return client.post("/oauth/token", data=data, auth=auth)


def token_set(client, reg):
    r = exchange(client, reg, get_code(client, reg))
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    return r.json()


def refresh(client, reg, raw, **kwargs):
    return client.post("/oauth/token", data={"client_id": reg["client_id"], "grant_type": "refresh_token",
                                            "refresh_token": raw, "resource": RESOURCE, **kwargs})


def test_discovery(client):
    m = client.get("/.well-known/oauth-protected-resource", headers=H()).json()
    assert m["authorization_servers"] == [ISSUER] and m["resource"] == RESOURCE
    d = client.get("/.well-known/oauth-authorization-server").json()
    assert d["issuer"] == ISSUER and d["code_challenge_methods_supported"] == ["S256"]
    assert d["registration_endpoint"] == ISSUER + "/oauth/register"
    assert client.get("/mcp/health", headers=H()).json()["authorization"] == "per-user"


@pytest.mark.parametrize("method", ["none", "client_secret_basic", "client_secret_post"])
def test_full_flow(client, method):
    reg = register(client, method)
    result = token_set(client, reg)
    assert rpc(client, "ping", token=result["access_token"]).status_code == 200
    assert "refresh_token" in result
    with SessionLocal() as db:
        assert db.get(OAuthCredential, result["access_token"]) is None
        assert db.get(OAuthCredential, O.digest(result["access_token"])) is not None


def test_login_then_consent(client):
    reg = register(client)
    client.cookies.clear()
    r = get_consent(client, reg)
    assert r.status_code == 302 and r.headers["location"].startswith("/auth/login?next=")
    back = parse_qs(urlsplit(r.headers["location"]).query)["next"][0]
    assert len(back) < 300
    login(client, "member@test.com")
    r = client.get(back)
    assert "member@test.com" in r.text and "允许访问" in r.text
    assert "code=" not in r.text


@pytest.mark.parametrize("over", [{"redirect_uri":"https://evil.test/cb"}, {"resource":"https://other.test"},
    {"scope":"admin"}, {"code_challenge_method":"plain"}, {"code_challenge":"bad"}, {"response_type":"token"}])
def test_authorize_rejects_bad_requests(client, over):
    reg = register(client)
    r = client.get("/oauth/authorize", params=auth_params(reg, **over), follow_redirects=False)
    assert r.status_code == 400 and "location" not in r.headers


def test_consent_csrf_denial_and_replay(client):
    reg = register(client, client_name='<script>alert(1)</script>')
    r = get_consent(client, reg)
    assert '<script>' not in r.text and '&lt;script&gt;' in r.text
    assert r.headers['referrer-policy'] == 'same-origin'
    assert 'no-transform' in r.headers['cache-control']
    data = inputs(r)
    assert client.post("/oauth/consent", data={**data, "decision":"allow"}, headers={"origin":"null"}).status_code == 403
    assert client.post("/oauth/consent", data={**data, "csrf":"bad", "decision":"allow"}).status_code == 403
    assert client.post("/oauth/consent", data={**data, "decision":"allow"}, headers={"origin":"https://evil.test"}).status_code == 403
    r = client.post("/oauth/consent", data={**data, "decision":"deny"}, headers={"origin":ISSUER}, follow_redirects=False)
    assert parse_qs(urlsplit(r.headers["location"]).query)["error"] == ["access_denied"]
    assert client.post("/oauth/consent", data={**data, "decision":"allow"}).status_code == 400


def test_consent_bound_to_account(client):
    reg = register(client)
    data = inputs(get_consent(client, reg))
    login(client, "other@test.com")
    assert client.post("/oauth/consent", data={**data, "decision":"allow"}).status_code == 403


@pytest.mark.parametrize("over", [{"code_verifier":"w"*64}, {"redirect_uri":"https://other.test/cb"}, {"resource":"https://other.test"}])
def test_code_binding(client, over):
    reg = register(client)
    code = get_code(client, reg)
    assert exchange(client, reg, code, **over).status_code == 400
    assert exchange(client, reg, code).status_code == 200


def test_code_client_binding_and_replay(client):
    one, two = register(client), register(client)
    code = get_code(client, one)
    assert exchange(client, two, code).status_code == 400
    result = exchange(client, one, code).json()
    assert exchange(client, one, code).status_code == 400
    assert rpc(client,"ping",token=result["access_token"]).status_code == 401


def test_refresh_rotation_and_replay(client):
    reg = register(client)
    result = token_set(client, reg)
    rotated = refresh(client, reg, result["refresh_token"])
    assert rotated.status_code == 200
    assert rotated.json()["refresh_token"] != result["refresh_token"]
    assert refresh(client, reg, result["refresh_token"]).status_code == 400
    assert rpc(client,"ping",token=rotated.json()["access_token"]).status_code == 401


def test_no_offline_no_refresh(client):
    reg = register(client)
    data = inputs(get_consent(client, reg, scope="mcp:read"))
    r = client.post("/oauth/consent", data={**data,"decision":"allow"}, follow_redirects=False)
    code = parse_qs(urlsplit(r.headers["location"]).query)["code"][0]
    assert "refresh_token" not in exchange(client,reg,code).json()


def test_revoke_client_ownership(client):
    reg, other = register(client), register(client)
    result = token_set(client, reg)
    client.post("/oauth/revoke", data={"client_id":other["client_id"],"token":result["refresh_token"]})
    assert rpc(client,"ping",token=result["access_token"]).status_code == 200
    client.post("/oauth/revoke", data={"client_id":reg["client_id"],"token":result["refresh_token"]})
    assert rpc(client,"ping",token=result["access_token"]).status_code == 401
    assert refresh(client,reg,result["refresh_token"]).status_code == 400


def test_browser_revoke_owner_only(client):
    reg = register(client)
    result = token_set(client, reg)
    fields = inputs(client.get("/oauth/connections"))
    login(client,"other@test.com")
    assert fields["grant_id"] not in client.get("/oauth/connections").text
    assert client.post("/oauth/connections/revoke", data=fields).status_code == 403
    _login_admin(client)
    r = client.post("/oauth/connections/revoke", data=inputs(client.get("/oauth/connections")), follow_redirects=False)
    assert r.status_code == 303
    assert rpc(client,"ping",token=result["access_token"]).status_code == 401


@pytest.mark.parametrize("kind", ["access_expired", "grant_expired", "wrong_resource", "wrong_scope", "deleted_user"])
def test_access_live_checks(client, kind):
    reg = register(client)
    result = token_set(client, reg)
    with SessionLocal() as db:
        cred = db.get(OAuthCredential,O.digest(result["access_token"]))
        grant = db.get(OAuthGrant,cred.grant_id)
        if kind == "access_expired": cred.expires = O.now()-1
        if kind == "grant_expired": grant.expires = O.now()-1
        if kind == "wrong_resource": grant.resource = "https://other.test"
        if kind == "wrong_scope": grant.scope = "other"
        if kind == "deleted_user": db.delete(db.get(User,grant.user_id))
        db.commit()
    assert rpc(client,"ping",token=result["access_token"]).status_code == 401


def test_private_data_isolation_and_public_data(client, monkeypatch):
    reg = register(client)
    sets = {}
    for email,symbol in [("alice@test.com","AAPL"),("bob@test.com","NVDA")]:
        login(client,email)
        client.put("/api/watchlist",json={"symbols":[symbol]})
        client.put("/api/flags",json={"symbols":[symbol]})
        client.post("/api/orders",json={"sym":symbol,"side":"buy","date":"2026-09-10","qty":1,"price":10})
        sets[symbol] = token_set(client,reg)["access_token"]
    async def public(*args,**kwargs): return {"bars":[["public"]]}
    monkeypatch.setattr(mcp_tools,"quant",public)
    # Browser is Bob, but Alice's bearer must always read Alice's rows.
    for symbol,access in sets.items():
        for name in ("watchlist","flags","orders","search"):
            r = rpc(client,"tools/call",{"name":name,"arguments":{"query":"","user_id":1,"email":"admin@example.com"}},token=access)
            out = json.loads(r.json()["result"]["content"][0]["text"])
            if name in ("watchlist","flags"): assert out["symbols"] == [symbol]
            if name == "orders": assert [o["sym"] for o in out["orders"]] == [symbol]
            if name == "search": assert out["ids"] == ["sym:"+symbol]
        assert rpc(client,"tools/call",{"name":"bars","arguments":{"symbol":"MU"}},token=access).json()["result"]


def test_no_unsafe_tools_or_cookie_auth(client):
    names = [t["name"] for t in rpc(client,"tools/list").json()["result"]["tools"]]
    assert "broker_account" not in names and "run_python" not in names
    for name in ("broker_account","run_python"):
        assert rpc(client,"tools/call",{"name":name}).json()["error"]["code"] == -32602
    r = client.post("/mcp",json={"method":"ping"},headers=H())
    assert r.status_code == 401 and 'scope="mcp:read"' in r.headers["www-authenticate"]
    result = token_set(client,register(client))
    for raw in (result["refresh_token"],"old.jwt.token",client.cookies.get("bide_session")):
        assert rpc(client,"ping",token=raw).status_code == 401


@pytest.mark.parametrize("uri",["http://evil.test/cb","https://ok.test/cb#fragment","https://user:pass@ok.test/cb","javascript:alert(1)"])
def test_bad_registration(client,uri):
    assert client.post("/oauth/register",json={"redirect_uris":[uri]}).status_code == 400


def test_host_and_duplicate_params(client):
    assert client.get("/mcp/health").status_code == 404
    assert client.post("/oauth/register",json={},headers=H()).status_code == 404
    reg = register(client)
    query = urlencode(auth_params(reg))+"&resource="+RESOURCE
    assert client.get("/oauth/authorize?"+query).status_code == 400


def test_expired_pending_code_refresh_and_client_secret(client):
    reg = register(client,"client_secret_post")
    code = get_code(client,reg)
    bad = {**reg,"client_secret":"bad"}
    assert exchange(client,bad,code).status_code == 401
    with SessionLocal() as db:
        db.get(OAuthCredential,O.digest(code)).expires = O.now()-1
        db.commit()
    assert exchange(client,reg,code).status_code == 400
    r = client.get("/oauth/authorize",params=auth_params(reg),follow_redirects=False)
    with SessionLocal() as db:
        for req in db.scalars(select(OAuthRequest)): req.expires=0
        db.commit()
    assert client.get(r.headers["location"]).status_code == 400


def test_initialize(client):
    r = rpc(client, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {}}, id_="init-1")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert "mcp-session-id" not in r.headers          # 无状态，不发会话头
    j = r.json()
    assert j["jsonrpc"] == "2.0" and j["id"] == "init-1"
    res = j["result"]
    assert res["protocolVersion"] == "2025-06-18"
    assert res["capabilities"] == {"tools": {"listChanged": False}}
    assert res["serverInfo"]["name"] == "bide"
    assert "dashboard_ranking" in res["instructions"]


def test_tools_list(client):
    r = rpc(client, "tools/list")
    tools = r.json()["result"]["tools"]
    names = [t["name"] for t in tools]
    assert names == ["watchlist", "flags", "orders", "market_meta", "quotes", "intraday",
                     "bars", "dashboard_ranking", "zone_detail", "coverage", "options", "fundamentals",
                     "search", "fetch"]
    for t in tools:
        assert set(t) == {"name", "description", "inputSchema", "annotations", "securitySchemes"}
        assert t["inputSchema"]["type"] == "object"


def test_notification_202(client):
    r = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=H(make_token()))
    assert r.status_code == 202
    assert r.content == b""


def test_batch(client):
    body = [
        {"jsonrpc": "2.0", "id": 1, "method": "ping"},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "nope"},
    ]
    r = client.post("/mcp", json=body, headers=H(make_token()))
    assert r.status_code == 200
    out = r.json()
    assert out == [
        {"jsonrpc": "2.0", "id": 1, "result": {}},
        {"jsonrpc": "2.0", "id": 2, "error": {"code": -32601, "message": "method not found: nope"}},
    ]
    r = client.post("/mcp", json=[{"jsonrpc": "2.0", "method": "notifications/initialized"}], headers=H(make_token()))
    assert r.status_code == 202


def test_unknown_tool_and_method(client):
    r = rpc(client, "tools/call", {"name": "nope"})
    assert r.json()["error"] == {"code": -32602, "message": "unknown tool: nope"}
    r = rpc(client, "resources/list", id_=None)
    assert r.json() == {"jsonrpc": "2.0", "id": None, "error": {"code": -32601, "message": "method not found: resources/list"}}


def test_invalid_json_400(client):
    r = client.post("/mcp", content=b"{not json", headers=H(make_token(), **{"content-type": "application/json"}))
    assert r.status_code == 400


def test_tool_exception_is_error_result(client, monkeypatch):
    async def boom(*_a, **_k):
        raise RuntimeError("quant down")
    monkeypatch.setattr(mcp_tools, "quant", boom)
    res, text = call_tool(client, "coverage")
    assert res["isError"] is True
    assert text == "tool error: quant down"


# ── 工具：关注 / 星标 / 订单（真实 DB）──────────────────────

def _login_admin(client):
    r = client.get("/auth/dev", params={"email": "admin@example.com", "admin": 1}, follow_redirects=False)
    assert r.status_code == 302


def test_watchlist_from_db(client):
    _login_admin(client)
    r = client.put("/api/watchlist", json={"symbols": ["nvda", "TQQQ", "^IXIC", "bad sym"]})
    assert r.status_code == 200
    r = client.put("/api/flags", json={"symbols": ["NVDA"]})
    assert r.status_code == 200
    r = client.post("/api/orders", json={"sym": "NVDA", "side": "buy", "date": "2024-01-02", "qty": 10, "price": 48.5})
    assert r.status_code == 200

    _, out = call_tool(client, "watchlist")
    assert out == {"symbols": ["NVDA", "TQQQ", "^IXIC"]}
    _, out = call_tool(client, "flags")
    assert out == {"symbols": ["NVDA"]}
    _, out = call_tool(client, "orders")
    assert len(out["orders"]) == 1
    assert out["orders"][0]["sym"] == "NVDA" and out["orders"][0]["qty"] == 10




class FakeQuant:
    def __init__(self):
        self.calls = []

    async def __call__(self, method, path, body=None, timeout=60):
        self.calls.append((method, path, body, timeout))
        p, _, q = path.partition("?")
        params = dict(kv.split("=", 1) for kv in q.split("&")) if q else {}
        if p == "/api/public/bars":
            sym = params.get("symbol", "").upper()
            f = os.path.join(FIXTURES, sym + ".json")
            if not os.path.exists(f):
                return {"error": "HTTP 404", "detail": "no such symbol"}
            return {"symbol": sym, "bars": load_bars(sym)}
        if p == "/api/coverage":
            return {"symbols": ["NVDA"]}
        if p == "/api/options/snapshots":
            if params.get("underlying") == "NONE":
                return {"snapshots": []}
            return {"snapshots": [{"snapshot_ts": "2025-01-02T00:00:00", "source": "cboe"}]}
        if p == "/api/options/chain.json":
            return {"chain": params}
        if p == "/api/fundamentals.json":
            return {"symbol": params.get("symbol")}
        if p == "/api/run":
            return {"stdout": "ok", "body": body}
        return {"error": "HTTP 404", "detail": path}


@pytest.fixture
def fq(monkeypatch):
    f = FakeQuant()
    monkeypatch.setattr(mcp_tools, "quant", f)
    monkeypatch.setattr(mcp_tools, "meta_for", lambda db, syms: {"names": {"TQQQ": {"under": "QQQ"}}})
    return f


def test_quant_tools(client, fq):
    _, out = call_tool(client, "bars", {"symbol": "NVDA"})
    assert len(out["bars"]) == 754
    assert fq.calls[-1][1] == "/api/public/bars?symbol=NVDA&days=400"
    _, out = call_tool(client, "coverage")
    assert out == {"symbols": ["NVDA"]}
    _, out = call_tool(client, "options", {"underlying": "NVDA", "expiry": "2025-03-21"})
    assert out["chain"] == {"underlying": "NVDA", "snapshot_ts": "2025-01-02T00%3A00%3A00", "source": "cboe", "expiry": "2025-03-21"}
    _, out = call_tool(client, "options", {"underlying": "NONE"})
    assert out == {"error": "这个标的还没有期权链快照", "underlying": "NONE"}
    _, out = call_tool(client, "fundamentals", {"symbol": "NVDA"})
    assert out == {"symbol": "NVDA"}


def test_dashboard_ranking(client, fq):
    _, out = call_tool(client, "dashboard_ranking", {"symbols": "NVDA,MU,AVGO,NOPE"})
    assert out["count"] == 3
    assert out["asOf"] == out["rows"][0]["date"]
    assert out["cuts"] == {"88": "以下是买入侧，越靠前越该买", "60": "以下：价格已涨过当初的建仓区"}
    ranks = [r["rank"] for r in out["rows"]]
    assert ranks == sorted(ranks, reverse=True)
    assert out["failed"] == [{"sym": "NOPE", "error": "拿不到日线"}]
    row = out["rows"][0]
    assert set(row) >= {"sym", "under", "date", "rank", "tier", "close", "chgPct", "rsi", "dist200Pct", "up200",
                        "zone", "edge", "wait", "todayCross", "warm", "notes"}
    assert "_an" not in row
    for r in out["rows"]:
        assert r["tier"] == mcp_tools.Z.tier_of(r["rank"])
        for n in r["notes"]:
            assert set(n) == {"label", "body", "sub"}

    # 与 zones.py 直接算的一致
    a = mcp_tools.Z.analyze(load_bars("NVDA"))
    a["wait"] = mcp_tools.Z.wait_of(a)
    nv = next(r for r in out["rows"] if r["sym"] == "NVDA")
    assert nv["rank"] == mcp_tools.Z.rank_of(a)
    assert nv["close"] == a["close"] and nv["date"] == a["date"]

    # min_rank 过滤
    _, out2 = call_tool(client, "dashboard_ranking", {"symbols": "NVDA,MU,AVGO", "min_rank": 80})
    assert all(r["rank"] >= 80 for r in out2["rows"])
    assert out2["count"] == len([r for r in ranks if r >= 80])

    # 日线缓存：第二次不再回源
    n = len([c for c in fq.calls if c[1].startswith("/api/public/bars")])
    assert n == 4                                # NVDA MU AVGO NOPE 各一次
    assert all(c[1].endswith("&years=3") for c in fq.calls if c[1].startswith("/api/public/bars"))


def test_dashboard_ranking_watchlist_and_leveraged(client, fq):
    """留空用关注列表；杠杆 ETF（TQQQ→QQQ）区间按正股算、价格用自己的。"""
    _login_admin(client)
    client.put("/api/watchlist", json={"symbols": ["TQQQ", "NVDA"]})
    _, out = call_tool(client, "dashboard_ranking", {})
    # QQQ 夹具不存在 → TQQQ 拿不到正股日线，进 failed；NVDA 正常
    assert [r["sym"] for r in out["rows"]] == ["NVDA"]
    assert out["failed"] == [{"sym": "TQQQ", "error": "拿不到日线"}]

    # 给 QQQ 造一份（拿 MU 的日线冒充），TQQQ 就能算了：区间来自 QQQ，close 是 TQQQ 自己的
    monkeypatch_bars = load_bars("MU")
    mcp_tools._bars_cache["QQQ"] = (time.time(), monkeypatch_bars)
    _, out = call_tool(client, "dashboard_ranking", {"symbols": "TQQQ"})
    row = out["rows"][0]
    assert row["under"] == "QQQ"
    tq = load_bars("TQQQ")
    assert row["close"] == tq[-1][4]
    assert abs(row["chgPct"] - (tq[-1][4] / tq[-2][4] - 1) * 100) < 1e-9
    a = mcp_tools.Z.analyze(monkeypatch_bars)
    a["wait"] = mcp_tools.Z.wait_of(a)
    assert row["rank"] == mcp_tools.Z.rank_of(a)
    assert row["date"] == a["date"]


def test_dashboard_ranking_empty(client, fq):
    _login_admin(client)
    client.put("/api/watchlist", json={"symbols": []})
    _, out = call_tool(client, "dashboard_ranking", {})
    assert out == {"error": "没有标的"}


def test_zone_detail(client, fq):
    _, out = call_tool(client, "zone_detail", {"symbol": " nvda "})
    assert out["sym"] == "NVDA" and out["under"] is None
    assert out["bars"] == 754
    assert out["from"] == load_bars("NVDA")[0][0] and out["to"] == load_bars("NVDA")[-1][0]
    p = mcp_tools.Z.panel(load_bars("NVDA"))
    assert out["zones"] == json.loads(json.dumps(p["zones"]))
    assert out["crosses"] == p["crosses"]
    assert out["warmPoints"] == p["warmPoints"]
    assert "rank" in out and "tier" in out and "wait" in out
    for z in out["zones"]:
        assert z["kind"] in ("a", "g", "b") and z["name"] == mcp_tools.Z.ZN[z["kind"]][0]

    _, out = call_tool(client, "zone_detail", {"symbol": ""})
    assert out == {"error": "要给 symbol"}
    _, out = call_tool(client, "zone_detail", {"symbol": "NOPE"})
    assert out == {"sym": "NOPE", "error": "拿不到日线"}


# ── search / fetch（ChatGPT 必需）───────────────────────────

def test_search_and_fetch(client, fq, monkeypatch):
    _login_admin(client)
    client.put("/api/watchlist", json={"symbols": ["NVDA", "NVDL", "MU"]})

    async def quotes(db, codes):
        return {"quotes": {c: {"last": 1.0} for c in codes}}
    monkeypatch.setattr(mcp_tools, "bg_quotes", quotes)

    _, out = call_tool(client, "search", {"query": "nvd"})
    assert out["ids"] == ["sym:NVDA", "sym:NVDL"]
    assert out["results"][0] == {"id": "sym:NVDA", "title": "NVDA", "url": "https://bide.test/dashboard#NVDA"}
    assert not any(i.startswith("post:") for i in out["ids"])

    _, out = call_tool(client, "fetch", {"id": "sym:NVDA"})
    assert out["id"] == "sym:NVDA" and out["title"] == "NVDA"
    assert "names" in out["meta"]
    assert out["quote"] == {"quotes": {"NVDA": {"last": 1.0}}}
    assert len(out["bars"]["bars"]) == 754
    assert fq.calls[-1][1] == "/api/public/bars?symbol=NVDA&days=400"

    _, out = call_tool(client, "fetch", {"id": "post:hello"})
    assert out == {"error": "id 只支持 sym: 前缀"}


# ── 序列化 ───────────────────────────────────────────────────

def test_to_text_nonfinite_and_utf8():
    s = mcp_tools.to_text({"a": float("inf"), "b": [float("nan"), 1.5], "c": "强势区"})
    assert json.loads(s) == {"a": None, "b": [None, 1.5], "c": "强势区"}
    assert "强势区" in s
    assert mcp_tools.to_text("raw") == "raw"


def test_qs():
    assert mcp_tools.qs({"symbol": "NVDA", "days": 400, "x": None, "y": ""}) == "?symbol=NVDA&days=400"
    assert mcp_tools.qs({}) == ""
    assert mcp_tools.qs({"syms": "NVDA,MU"}) == "?syms=NVDA%2CMU"




def test_verified_email_cannot_take_other_identity(client):
    from bide.auth import upsert_user, is_admin_claims
    with SessionLocal() as db:
        legacy = User(email="legacy@test.com")
        db.add(legacy)
        db.commit()
        old_id = legacy.id
        with pytest.raises(ValueError):
            upsert_user(db, {"sub":"attacker", "email":"legacy@test.com", "email_verified":False})
        owner, _ = upsert_user(db, {"sub":"real-owner", "email":"legacy@test.com", "email_verified":True})
        assert owner.id == old_id
        with pytest.raises(ValueError):
            upsert_user(db, {"sub":"different-owner", "email":"legacy@test.com", "email_verified":True})
        assert db.get(User, old_id).sub == "real-owner"


def test_parallel_code_exchange_only_once(client):
    from concurrent.futures import ThreadPoolExecutor
    reg = register(client)
    code = get_code(client, reg)
    def go(_):
        with TestClient(app, base_url=ISSUER) as other:
            return exchange(other, reg, code)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(go, range(2)))
    assert sorted(r.status_code for r in results) == [200, 400]
    token = next(r.json()["access_token"] for r in results if r.status_code == 200)
    assert rpc(client, "ping", token=token).status_code == 401


def test_expired_refresh_and_token_scope(client):
    reg = register(client)
    result = token_set(client, reg)
    assert refresh(client, reg, result["refresh_token"], scope="admin").status_code == 400
    with SessionLocal() as db:
        db.get(OAuthCredential, O.digest(result["refresh_token"])).expires = 0
        db.commit()
    assert refresh(client, reg, result["refresh_token"]).status_code == 400


def test_registration_limits_and_oversize(client):
    assert client.post("/oauth/register", content=b"x"*17000).status_code == 413
    for _ in range(30): register(client)
    assert client.post("/oauth/register", json={}).status_code == 429


def test_browser_logout_revokes_linked_mcp(client):
    reg = register(client)
    result = token_set(client, reg)
    from bide.auth import manager
    response = client.get("/auth/logout")
    r = client.post("/auth/logout", data=inputs(response), follow_redirects=False)
    assert r.status_code == 303
    assert rpc(client, "ping", token=result["access_token"]).status_code == 401


def test_consent_csp_allows_only_registered_callback_origin(client):
    reg = register(client)
    response = get_consent(client, reg)
    target = urlsplit(reg['redirect_uris'][0])
    expected = target.scheme + '://' + target.netloc
    assert "form-action 'self' " + expected + ";" in response.headers['content-security-policy']
    assert "form-action 'self';" in client.get('/oauth/connections').headers['content-security-policy']
    hostile = O.page('test', '', 'https://bad.test;script-src/return')
    assert 'bad.test%3Bscript-src' in hostile.headers['content-security-policy']
    assert ';script-src' not in hostile.headers['content-security-policy']


def test_account_api_only_exposes_token_owner(client, monkeypatch):
    from bide.auth import manager
    from fujioky_auth.provider import InvalidToken
    make_token()
    login(client, 'other@example.com')
    make_token('other@example.com')
    async def userinfo(token):
        if token != 'owner-token': raise InvalidToken()
        return {'sub': 'dev:admin@example.com'}
    monkeypatch.setattr(manager.provider, 'userinfo', userinfo)
    assert client.get('/api/account/connections').status_code == 401
    headers={'Authorization':'Bearer owner-token'}
    rows=client.get('/api/account/connections',headers=headers).json()['grants']
    assert len(rows)==1
    with SessionLocal() as db:
        other=db.scalar(select(User).where(User.email=='other@example.com'))
        foreign=db.scalar(select(OAuthGrant).where(OAuthGrant.user_id==other.id)).id
    assert client.delete('/api/account/connections/'+foreign,headers=headers).status_code==200
    with SessionLocal() as db: assert not db.get(OAuthGrant,foreign).revoked
    assert client.delete('/api/account/connections/'+rows[0]['id'],headers=headers).status_code==200
    assert client.get('/api/account/connections',headers=headers).json()['grants']==[]
