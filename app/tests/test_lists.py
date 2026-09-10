"""关注/星标/订单/已读接口与登录门禁。"""
import os
import tempfile

os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="bide-test-"))
os.environ["DEV_LOGIN"] = "1"
os.environ["SESSION_SECRET"] = "test"
os.environ["BASE_URL"] = "http://testserver"

import pytest
from fastapi.testclient import TestClient

from bide.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def user(client):
    r = client.get("/auth/dev?email=t@example.com", follow_redirects=False)
    assert r.status_code == 302
    return client


def test_requires_login(client):
    fresh = TestClient(app)
    assert fresh.get("/api/watchlist").status_code == 401
    assert fresh.get("/dashboard").status_code == 403


def test_watchlist_roundtrip(user):
    r = user.put("/api/watchlist", json={"symbols": ["nvda", "^IXIC", "bad sym", "NVDA", 123]})
    assert r.json() == {"ok": True, "symbols": ["NVDA", "^IXIC"]}
    assert user.get("/api/watchlist").json() == {"symbols": ["NVDA", "^IXIC"]}
    assert user.put("/api/watchlist", json={"symbols": "x"}).status_code == 400


def test_flags_reject_index(user):
    r = user.put("/api/flags", json={"symbols": ["^IXIC", "MU"]})
    assert r.json()["symbols"] == ["MU"]


def test_orders(user):
    bad = user.post("/api/orders", json={"sym": "NVDA", "side": "buy", "date": "2026-9-1", "qty": 1, "price": 1})
    assert bad.status_code == 400
    r = user.post("/api/orders", json={"sym": "nvda", "side": "sell", "date": "2026-09-01", "qty": 2.5, "price": 180.123456, "note": "x" * 100})
    o = r.json()["order"]
    assert o["sym"] == "NVDA" and o["side"] == "sell" and o["price"] == 180.1235 and len(o["note"]) == 80
    assert user.get("/api/orders").json()["orders"][0]["id"] == o["id"]
    assert user.delete("/api/orders/" + o["id"]).json() == {"ok": True, "orders": []}
    assert user.delete("/api/orders/nope").status_code == 404


def test_reads(user):
    r = user.put("/api/reads", json={"reads": {"NVDA": "2026-09-10", "bad": "x", "MU": "nope"}})
    assert r.json() == {"ok": True, "reads": {"NVDA": "2026-09-10"}}


def test_whoami_shape(user):
    j = user.get("/auth/whoami").json()
    assert set(j) >= {"signedIn", "admin", "name", "avatar", "authReady"}
    assert j["signedIn"] is True and j["admin"] is False


def test_dashboard_served(user):
    r = user.get("/dashboard")
    assert r.status_code == 200 and "/presence.js" in r.text and "/static/tickerchart.js" in r.text
