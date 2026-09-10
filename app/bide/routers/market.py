"""市场元数据接口：/api/market/meta · /api/market/stream(SSE) · 管理员的 state / tags / refresh。
逻辑都在 services.market_meta，这里只做参数解析、门禁和 SSE 连接管理。"""
import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..db import get_db
from ..models import User
from ..services import market_meta
from ..services.market_meta import svc

router = APIRouter()
NO_STORE = {"cache-control": "no-store"}
MAX_CLIENTS = 40
HEARTBEAT_SEC = 25


async def _body(request: Request) -> dict:
    try:
        b = await request.json()
    except Exception:  # noqa: BLE001
        return {}
    return b if isinstance(b, dict) else {}


@router.get("/api/market/meta")
async def meta(syms: str = "", db: Session = Depends(get_db)):
    return JSONResponse(market_meta.meta_for(db, market_meta.parse_syms(syms)), headers=NO_STORE)


async def sse_gen(q: asyncio.Queue) -> AsyncIterator[str]:
    """一个客户端一条流：先发 retry，之后有数据发数据、25 秒没数据发一次心跳。断开时把队列摘掉。"""
    try:
        yield "retry: 20000\n\n"
        while True:
            try:
                line = await asyncio.wait_for(q.get(), HEARTBEAT_SEC)
            except asyncio.TimeoutError:
                line = ": hb\n\n"
            yield line
    finally:
        svc.clients.discard(q)


@router.get("/api/market/stream")
async def stream():
    if len(svc.clients) >= MAX_CLIENTS:
        return JSONResponse({"error": "连接数已满"}, status_code=503)
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    svc.clients.add(q)
    return StreamingResponse(sse_gen(q), media_type="text/event-stream; charset=utf-8", headers={
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })


# 管理员：看状态 / 手动触发一次全量刷新
@router.get("/api/market/state")
async def state(_: User = Depends(require_admin)):
    return JSONResponse(market_meta.state(), headers=NO_STORE)


# 手工调整标签（自动打完之后在界面上改的走这条）
@router.put("/api/market/tags")
async def tags_put(request: Request, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    b = await _body(request)
    return market_meta.set_tags(db, b.get("tags") or {})


@router.post("/api/market/refresh")
async def refresh(request: Request, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    return market_meta.refresh(db, await _body(request))


async def startup(app: FastAPI) -> None:
    await svc.start()


async def shutdown(app: FastAPI) -> None:
    await svc.stop()
