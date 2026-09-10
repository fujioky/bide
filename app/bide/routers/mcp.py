"""mcp.bide.example.com —— 给 AI 客户端（Claude / ChatGPT / Grok）用的只读数据 MCP。
blog/mcp.js 的移植，形态上的三个决定原样保留，改之前先读这里：

1) 传输一律 Streamable HTTP，**永不开 SSE**。
   ingress 会不会缓冲响应我们控制不了，所以 POST /mcp 一律回单个 application/json，
   GET /mcp 直接 405，不留流式路径。

2) 无状态。initialize 不发 Mcp-Session-Id，客户端也就不用带回来。
   三家客户端对会话头的处理不一致，不发是唯一都不出错的做法。

3) 私有数据按 BIDE OAuth 授权用户的本地 user_id 隔离；公共行情共享。

鉴权：BIDE 签发的只读访问令牌，每次请求检查授权是否撤销。
所有 MCP 路由只在 Host 头等于 MCP_HOST 时应答。

"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from . import mcp_oauth
from ..services import mcp_auth
from ..services import mcp_tools as T

log = logging.getLogger("mcp")
router = APIRouter()

RESOURCE = f"https://{settings.mcp_host}"
CHALLENGE = f'Bearer realm="{RESOURCE}", resource_metadata="{RESOURCE}/.well-known/oauth-protected-resource", scope="mcp:read"'
_BEARER = re.compile(r"^Bearer\s+", re.I)


def on_mcp_host(request: Request) -> bool:
    return str(request.headers.get("host") or "").split(":")[0] == settings.mcp_host


def _not_found() -> JSONResponse:
    return JSONResponse({"error": "not found"}, status_code=404)


# ── JSON-RPC ─────────────────────────────────────────────────

def rpc_ok(id_, result) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "result": result}


def rpc_err(id_, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


async def handle_rpc(msg, ctx: T.Ctx) -> dict:
    if not isinstance(msg, dict):
        return rpc_err(None, -32600, "invalid request")
    id_, method, params = msg.get("id"), msg.get("method"), msg.get("params")
    params = params if isinstance(params, dict) else {}
    if method == "initialize":
        # 客户端发的版本各家不一样，不硬校验，回我们支持的那个
        return rpc_ok(id_, {
            "protocolVersion": T.PROTOCOL,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": T.SERVER_INFO,
            "instructions": T.INSTRUCTIONS,
        })
    if method == "ping":
        return rpc_ok(id_, {})
    if method == "tools/list":
        return rpc_ok(id_, {"tools": T.TOOL_LIST})
    if method == "tools/call":
        name = params.get("name")
        t = T.find_tool(name)
        if not t:
            return rpc_err(id_, -32602, f"unknown tool: {name}")
        args = params.get("arguments")
        try:
            out = await t["run"](ctx, args if isinstance(args, dict) else {})
            return rpc_ok(id_, {"content": [{"type": "text", "text": T.to_text(out)}]})
        except Exception as e:  # noqa: BLE001
            log.warning("tool %s failed: %s", name, e)
            return rpc_ok(id_, {"content": [{"type": "text", "text": f"tool error: {e}"}], "isError": True})
    return rpc_err(id_, -32601, f"method not found: {method}")


def is_notification(m) -> bool:
    """通知 = 没有 id 字段（id: null 仍算请求，与 JS 的 `m.id === undefined` 一致）。"""
    return isinstance(m, dict) and "id" not in m


# ── RFC 9728 受保护资源元数据 ──
#    BIDE 是授权服务器；Logto 仅负责浏览器登录。

def prm() -> dict:
    return {
        "resource": RESOURCE,
        "authorization_servers": [mcp_oauth.ISSUER],
        "bearer_methods_supported": ["header"],
        "scopes_supported": [mcp_oauth.SCOPE, "offline_access"],
    }


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/mcp")
def protected_resource(request: Request):
    if not on_mcp_host(request):
        return _not_found()
    return JSONResponse(prm())


@router.get("/mcp/health")
def health(request: Request):
    if not on_mcp_host(request):
        return _not_found()
    return {
        "ok": True,
        "resource": RESOURCE,
        "issuer": mcp_oauth.ISSUER,
        "authorization": "per-user",
        "tools": len(T.TOOL_LIST),
        "quant_key": bool(settings.quant_api_key),
        "protocol": T.PROTOCOL,
    }


@router.get("/mcp")
def mcp_get(request: Request):
    """规范里 GET /mcp 是可选的 SSE 通道。我们不开流，直接 405，
    免得探这个口的客户端挂在那里等到超时。"""
    if not on_mcp_host(request):
        return _not_found()
    return JSONResponse({"error": "use POST"}, status_code=405, headers={"allow": "POST"})


@router.post("/mcp")
async def mcp_post(request: Request, db: Session = Depends(get_db)):
    if not on_mcp_host(request):
        return _not_found()

    auth = str(request.headers.get("authorization") or "")
    if not _BEARER.match(auth):
        return JSONResponse({"error": "bearer token required"}, status_code=401,
                            headers={"www-authenticate": CHALLENGE})
    v = await mcp_auth.verify_token(_BEARER.sub("", auth, count=1), db)
    if not v["ok"]:
        headers = {}
        if v["code"] == 401:
            headers["www-authenticate"] = CHALLENGE + f', error="invalid_token", error_description="{v["msg"]}"'
        return JSONResponse({"error": v["msg"]}, status_code=v["code"], headers=headers)

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"error": "invalid json"}, status_code=400)

    ctx = T.Ctx(db=db, uid=v["uid"])
    # 通知（没有 id）一律 202 空体：回 200 带 JSON 有客户端会解析失败
    if isinstance(body, list):
        out = [await handle_rpc(m, ctx) for m in body if not is_notification(m)]
        if not out:
            return Response(status_code=202)
        return JSONResponse(out)
    if is_notification(body):
        return Response(status_code=202)
    return JSONResponse(await handle_rpc(body, ctx))


async def startup(app) -> None:
    log.info("mcp registered · host=%s · tools=%d · authorization=per-user", settings.mcp_host, len(T.TOOL_LIST))
