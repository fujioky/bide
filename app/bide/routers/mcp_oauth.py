"""BIDE is the MCP authorization server; Logto remains the login provider.

Authorization is always an explicit, session-bound user decision. Public and
confidential clients use S256 PKCE. Codes are single-use; refresh token reuse
revokes the grant. No Logto credential or browser cookie leaves BIDE.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import json
import re
import secrets
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit, unquote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from ..auth import current_user
from ..config import settings
from ..db import get_db
from ..models import OAuthClient, OAuthCredential, OAuthGrant, OAuthRequest, OAuthSessionGrant, User

ISSUER = settings.base_url
RESOURCE = f"https://{settings.mcp_host}"
SCOPE = "mcp:read"
ACCESS_TTL = 3600
GRANT_TTL = 30 * 86400
NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
PAGE_HEADERS = {**NO_STORE, "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
                "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}


def require_host(request: Request):
    if not settings.session_secret:
        raise HTTPException(503, "SESSION_SECRET must be configured")
    if request.headers.get("host", "").lower() != urlsplit(ISSUER).netloc.lower():
        raise HTTPException(404)


router = APIRouter(dependencies=[Depends(require_host)])


def now():
    return int(time.time())


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def fail(error: str, description: str = "", status: int = 400):
    raise HTTPException(status, {"error": error, "error_description": description}, headers=NO_STORE)


def metadata():
    return {"issuer": ISSUER, "authorization_endpoint": ISSUER + "/oauth/authorize",
            "token_endpoint": ISSUER + "/oauth/token", "registration_endpoint": ISSUER + "/oauth/register",
            "revocation_endpoint": ISSUER + "/oauth/revoke", "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_methods_supported": ["none", "client_secret_basic", "client_secret_post"],
            "revocation_endpoint_auth_methods_supported": ["none", "client_secret_basic", "client_secret_post"],
            "code_challenge_methods_supported": ["S256"], "scopes_supported": [SCOPE, "offline_access"],
            "authorization_response_iss_parameter_supported": True}


@router.get("/.well-known/oauth-authorization-server")
def discovery():
    return JSONResponse(metadata(), headers=NO_STORE)


async def read_body(request: Request) -> bytes:
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 16384:
            fail("invalid_request", "Request too large", 413)
    return bytes(data)


def unique_pairs(pairs):
    out = {}
    for k, v in pairs:
        if k in out:
            fail("invalid_request", "Duplicate parameter")
        out[k] = v
    return out


async def form(request: Request):
    if request.headers.get("content-type", "").split(";")[0] != "application/x-www-form-urlencoded":
        fail("invalid_request", "Expected form encoding")
    try:
        return unique_pairs(parse_qsl((await read_body(request)).decode(), keep_blank_values=True, max_num_fields=30))
    except (ValueError, UnicodeError):
        fail("invalid_request", "Invalid form")


def valid_redirect(uri):
    if not isinstance(uri, str) or len(uri) > 2000 or any(ord(c) <= 32 for c in uri) or "\\" in uri:
        return False
    try:
        p = urlsplit(uri)
        return (p.scheme == "https" and bool(p.hostname) and not p.username and not p.password
                and not p.fragment and p.port in (None, 443))
    except ValueError:
        return False


@router.post("/oauth/register")
async def register(request: Request, db: Session = Depends(get_db)):
    # Global DB-backed limits avoid trusting proxy headers and work across workers.
    if db.scalar(select(func.count()).select_from(OAuthClient).where(OAuthClient.created > now() - 60)) >= 30:
        fail("temporarily_unavailable", "Try again later", 429)
    if db.scalar(select(func.count()).select_from(OAuthClient)) >= 10000:
        fail("temporarily_unavailable", "Registration capacity reached", 429)
    try:
        data = json.loads(await read_body(request))
    except (ValueError, UnicodeError):
        fail("invalid_client_metadata")
    if not isinstance(data, dict):
        fail("invalid_client_metadata")
    redirects = data.get("redirect_uris")
    if not isinstance(redirects, list) or not 1 <= len(redirects) <= 10 or not all(valid_redirect(x) for x in redirects):
        fail("invalid_redirect_uri", "HTTPS callback URLs required")
    method = data.get("token_endpoint_auth_method", "client_secret_basic")
    if method not in metadata()["token_endpoint_auth_methods_supported"]:
        fail("invalid_client_metadata", "Unsupported authentication method")
    grants = data.get("grant_types", ["authorization_code"])
    if (not isinstance(grants, list) or not all(isinstance(g, str) for g in grants)
            or "authorization_code" not in grants or set(grants) - {"authorization_code", "refresh_token"}
            or data.get("response_types", ["code"]) != ["code"]):
        fail("invalid_client_metadata", "Unsupported grant")
    client_id = secrets.token_urlsafe(32)
    secret = secrets.token_urlsafe(48) if method != "none" else ""
    name = data.get("client_name", "MCP 客户端")
    if not isinstance(name, str) or not name.strip() or len(name) > 120:
        fail("invalid_client_metadata", "Invalid client name")
    db.add(OAuthClient(id=client_id, name=name, redirects=redirects, auth_method=method,
                       secret_hash=digest(secret) if secret else "", created=now()))
    db.commit()
    out = {"client_id": client_id, "client_name": name, "redirect_uris": redirects,
           "token_endpoint_auth_method": method, "grant_types": ["authorization_code", "refresh_token"],
           "response_types": ["code"], "client_id_issued_at": now()}
    if secret:
        out.update(client_secret=secret, client_secret_expires_at=0)
    return JSONResponse(out, status_code=201, headers=NO_STORE)


def callback(uri: str, params: dict):
    p = urlsplit(uri)
    query = parse_qsl(p.query, keep_blank_values=True) + list(params.items())
    return RedirectResponse(urlunsplit((p.scheme, p.netloc, p.path, urlencode(query), "")), status_code=302, headers=NO_STORE)


def csrf(request: Request, key: str, uid: int) -> str:
    nonce = request.session.get("mcp_csrf")
    if not nonce:
        nonce = secrets.token_urlsafe(32)
        request.session["mcp_csrf"] = nonce
    return hmac.new(nonce.encode(), f"{key}:{uid}".encode(), hashlib.sha256).hexdigest()


def check_csrf(request, key, uid, value):
    if not request.session.get("mcp_csrf") or not hmac.compare_digest(csrf(request, key, uid), str(value or "")):
        fail("invalid_request", "页面已过期，请重新打开", 403)
    if request.headers.get("origin") not in (None, ISSUER):
        fail("invalid_request", "Invalid origin", 403)


def page(title: str, body: str):
    return HTMLResponse('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>''' + html.escape(title) + ''' · BIDE</title><style>body{font:17px/1.7 system-ui;background:#f5f5f3;color:#202623;margin:0;padding:40px 20px}main{max-width:620px;margin:5vh auto;background:white;padding:32px;border-radius:16px}h1{font-size:26px}button{font:inherit;padding:9px 22px;border:1px solid #b7c3ba;border-radius:8px;background:#163f2e;color:white;cursor:pointer;margin:8px 8px 0 0}a{color:#24553f}.muted{color:#626b65;overflow-wrap:anywhere}article{border-top:1px solid #ddd;padding:18px 0}input{display:none}</style><main><a href="/dashboard">BIDE</a><h1>''' + html.escape(title) + "</h1>" + body + "</main></html>", headers=PAGE_HEADERS)


@router.get("/oauth/authorize")
def authorize(request: Request, db: Session = Depends(get_db)):
    p = unique_pairs(request.query_params.multi_items())
    client = db.get(OAuthClient, p.get("client_id", ""))
    if not client or p.get("redirect_uri") not in client.redirects:
        fail("invalid_request", "Unknown client or callback")
    if p.get("response_type") != "code":
        fail("unsupported_response_type")
    if p.get("resource") != RESOURCE:
        fail("invalid_target", "MCP resource required")
    scopes = p.get("scope", SCOPE).split()
    if SCOPE not in scopes or set(scopes) - {SCOPE, "offline_access"}:
        fail("invalid_scope")
    if p.get("code_challenge_method") != "S256" or not re.fullmatch(r"[A-Za-z0-9_-]{43}", p.get("code_challenge", "")):
        fail("invalid_request", "S256 PKCE required")
    if len(p.get("state", "")) > 2048:
        fail("invalid_request", "State too long")
    if db.scalar(select(func.count()).select_from(OAuthRequest).where(OAuthRequest.expires > now())) >= 1000:
        fail("temporarily_unavailable", "Try again later", 429)
    db.execute(delete(OAuthRequest).where(OAuthRequest.expires < now()))
    db.execute(delete(OAuthGrant).where(OAuthGrant.expires < now()))
    key = secrets.token_urlsafe(32)
    allowed = {k: p.get(k, "") for k in ("redirect_uri", "state", "code_challenge")}
    allowed["scope"] = " ".join(sorted(set(scopes)))
    db.add(OAuthRequest(id=key, client_id=client.id, params=allowed, expires=now() + 600))
    db.commit()
    return RedirectResponse("/oauth/consent?request_id=" + key, status_code=302, headers=NO_STORE)


def pending(db, key):
    req = db.get(OAuthRequest, key)
    if not req or req.consumed or req.expires <= now():
        fail("invalid_request", "授权请求已过期，请从客户端重新连接")
    return req


@router.get("/oauth/consent")
def consent(request: Request, request_id: str, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    req = pending(db, request_id)
    if not user:
        return RedirectResponse("/auth/login?" + urlencode({"next": "/oauth/consent?request_id=" + request_id}), status_code=302, headers=NO_STORE)
    client = db.get(OAuthClient, req.client_id)
    p = req.params
    esc = html.escape
    body = f'<p><strong>{esc(client.name)}</strong> 请求访问你的 BIDE 数据。</p><p>当前账号：{esc(user.email)}</p>'
    body += '<ul><li>读取你的关注、星标和手工订单。</li><li>查询公共行情、财报、期权和指标。</li></ul><p>不会修改数据或下单，不会读取其他用户的数据。</p>'
    if "offline_access" in p["scope"].split():
        body += '<p>允许客户端在你离线时继续读取，最长 30 天；你可以随时撤销。</p>'
    body += f'<p class="muted">客户端名称由对方提供，请确认回调地址：<br>{esc(p["redirect_uri"])}</p>'
    body += f'<form method="post" action="/oauth/consent"><input type="hidden" name="request_id" value="{esc(req.id)}"><input type="hidden" name="csrf" value="{csrf(request, req.id, user.id)}"><button name="decision" value="allow">允许访问</button><button name="decision" value="deny">取消</button></form><p><a href="/oauth/connections">管理已授权应用</a></p>'
    return page("授权应用", body)


def new_credential(db, grant_id, kind, ttl, **kwargs):
    raw = "bide_" + kind + "_" + secrets.token_urlsafe(48)
    db.add(OAuthCredential(digest=digest(raw), grant_id=grant_id, kind=kind, expires=now() + ttl, **kwargs))
    return raw


@router.post("/oauth/consent")
async def approve(request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    if not user:
        fail("login_required", status=401)
    data = await form(request)
    req = pending(db, data.get("request_id", ""))
    check_csrf(request, req.id, user.id, data.get("csrf"))
    if data.get("decision") not in ("allow", "deny"):
        fail("invalid_request")
    changed = db.execute(update(OAuthRequest).where(OAuthRequest.id == req.id, OAuthRequest.consumed.is_(False), OAuthRequest.expires > now()).values(consumed=True))
    if changed.rowcount != 1:
        fail("invalid_request", "Request already used")
    p = req.params
    out = {"state": p["state"], "iss": ISSUER}
    if data["decision"] == "deny":
        out["error"] = "access_denied"
    else:
        grant = OAuthGrant(id=secrets.token_urlsafe(32), client_id=req.client_id, user_id=user.id,
                           scope=p["scope"], resource=RESOURCE, created=now(), expires=now() + GRANT_TTL)
        db.add(grant)
        db.flush()
        db.add(OAuthSessionGrant(grant_id=grant.id, session_id=request.state.auth_session.id))
        out["code"] = new_credential(db, grant.id, "code", 120, redirect_uri=p["redirect_uri"], challenge=p["code_challenge"])
    db.commit()
    return callback(p["redirect_uri"], out)


def authenticate_client(request, data, db):
    client_id, secret = data.get("client_id", ""), data.get("client_secret", "")
    method = "client_secret_post" if "client_secret" in data else "none"
    auth = request.headers.get("authorization", "")
    if auth:
        if not auth.lower().startswith("basic ") or "client_secret" in data:
            fail("invalid_client", status=401)
        try:
            ident, secret = base64.b64decode(auth[6:], validate=True).decode().split(":", 1)
            ident, secret = unquote(ident), unquote(secret)
            if client_id and client_id != ident:
                fail("invalid_client", status=401)
            client_id = ident
        except (ValueError, UnicodeError):
            fail("invalid_client", status=401)
        method = "client_secret_basic"
    client = db.get(OAuthClient, client_id)
    if not client or client.auth_method != method:
        fail("invalid_client", status=401)
    if method != "none" and not hmac.compare_digest(client.secret_hash, digest(secret)):
        fail("invalid_client", status=401)
    return client


def tokens(db, grant, refresh):
    remaining = grant.expires - now()
    ttl = min(ACCESS_TTL, remaining)
    out = {"access_token": new_credential(db, grant.id, "access", ttl), "token_type": "Bearer",
           "expires_in": ttl, "scope": grant.scope}
    if refresh:
        out["refresh_token"] = new_credential(db, grant.id, "refresh", remaining)
    return out


@router.post("/oauth/token")
async def token(request: Request, db: Session = Depends(get_db)):
    data = await form(request)
    client = authenticate_client(request, data, db)
    typ = data.get("grant_type")
    if typ not in ("authorization_code", "refresh_token"):
        fail("unsupported_grant_type")
    kind = "code" if typ == "authorization_code" else "refresh"
    cred = db.get(OAuthCredential, digest(data.get("code" if kind == "code" else "refresh_token", "")))
    grant = db.get(OAuthGrant, cred.grant_id) if cred else None
    if not cred or cred.kind != kind or not grant or grant.client_id != client.id or grant.revoked or grant.expires <= now() or not db.get(User, grant.user_id):
        fail("invalid_grant")
    if data.get("resource") != grant.resource:
        fail("invalid_target")
    if kind == "code":
        verifier = data.get("code_verifier", "")
        if not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier):
            fail("invalid_grant")
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        if not hmac.compare_digest(challenge, cred.challenge) or data.get("redirect_uri") != cred.redirect_uri:
            fail("invalid_grant")
    if "scope" in data and data["scope"] != grant.scope:
        fail("invalid_scope")
    if cred.used:
        grant.revoked = True
        db.commit()
        fail("invalid_grant", "Credential reused; authorization revoked")
    if cred.expires <= now():
        fail("invalid_grant")
    changed = db.execute(update(OAuthCredential).where(OAuthCredential.digest == cred.digest, OAuthCredential.used.is_(False), OAuthCredential.expires > now()).values(used=True))
    if changed.rowcount != 1:
        db.execute(update(OAuthGrant).where(OAuthGrant.id == grant.id).values(revoked=True))
        db.commit()
        fail("invalid_grant")
    out = tokens(db, grant, "offline_access" in grant.scope.split())
    db.commit()
    return JSONResponse(out, headers=NO_STORE)


@router.post("/oauth/revoke")
async def revoke(request: Request, db: Session = Depends(get_db)):
    data = await form(request)
    client = authenticate_client(request, data, db)
    cred = db.get(OAuthCredential, digest(data.get("token", "")))
    if cred and cred.kind in ("access", "refresh"):
        db.execute(update(OAuthGrant).where(OAuthGrant.id == cred.grant_id, OAuthGrant.client_id == client.id).values(revoked=True))
        db.commit()
    return JSONResponse({}, headers=NO_STORE)


@router.get("/oauth/connections")
def connections(request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    if not user:
        return RedirectResponse("/auth/login?next=/oauth/connections", status_code=302, headers=NO_STORE)
    grants = db.scalars(select(OAuthGrant).where(OAuthGrant.user_id == user.id, OAuthGrant.revoked.is_(False), OAuthGrant.expires > now()).order_by(OAuthGrant.created.desc())).all()
    body = f'<p>当前账号：{html.escape(user.email)}</p><p>撤销后，该应用的访问令牌和刷新令牌立即失效。</p>'
    for grant in grants:
        client = db.get(OAuthClient, grant.client_id)
        body += f'<article><strong>{html.escape(client.name)}</strong><p class="muted">{html.escape(", ".join(client.redirects))}</p><form method="post" action="/oauth/connections/revoke"><input type="hidden" name="grant_id" value="{grant.id}"><input type="hidden" name="csrf" value="{csrf(request, "revoke:" + grant.id, user.id)}"><button>撤销授权</button></form></article>'
    return page("已授权应用", body if grants else body + "<p>暂无有效授权。</p>")


@router.post("/oauth/connections/revoke")
async def disconnect(request: Request, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    if not user:
        fail("login_required", status=401)
    data = await form(request)
    key = data.get("grant_id", "")
    check_csrf(request, "revoke:" + key, user.id, data.get("csrf"))
    db.execute(update(OAuthGrant).where(OAuthGrant.id == key, OAuthGrant.user_id == user.id).values(revoked=True))
    db.commit()
    return RedirectResponse("/oauth/connections", status_code=303, headers=NO_STORE)
