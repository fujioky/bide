"""bide —— 看板、关注/星标/订单、行情元数据、Bitget、MCP。
启动：uvicorn bide.main:app --host 0.0.0.0 --port 8080
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import auth, pages
from .config import settings
from .db import init_db
from .routers import dashboard, lists, notify, mcp_oauth

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("bide")
HERE = Path(__file__).resolve().parent


def _optional_routers():
    """行情元数据 / Bitget / MCP 三个模块各自独立，缺哪个都不影响其它部分起来。"""
    out = []
    for name in ("market", "bitget", "mcp"):
        try:
            mod = __import__(f"bide.routers.{name}", fromlist=["router"])
            out.append((name, mod))
        except ImportError as e:
            log.warning("router %s not loaded: %s", name, e)
    return out


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.on_login = notify.registered
    for name, mod in app.state.optional:
        start = getattr(mod, "startup", None)
        if start:
            await start(app)
    log.info("bide up · auth=%s · quant=%s · agent=%s", settings.auth_ready, settings.quant_base, bool(settings.agent_url))
    yield
    for name, mod in app.state.optional:
        stop = getattr(mod, "shutdown", None)
        if stop:
            await stop(app)


app = FastAPI(title="bide", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret or "dev-insecure",
                   session_cookie="bide_oidc", max_age=600, same_site="lax",
                   https_only=settings.base_url.startswith("https"))

app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
app.mount("/ds", StaticFiles(directory=HERE / "static" / "ds"), name="ds")

app.include_router(auth.router)
app.include_router(mcp_oauth.router)
app.include_router(lists.router)
app.include_router(notify.router)
app.include_router(dashboard.router)
app.state.optional = _optional_routers()
for _name, _mod in app.state.optional:
    app.include_router(_mod.router)


@app.exception_handler(HTTPException)
async def _http_exc(request: Request, exc: HTTPException):
    """detail 是 dict 时原样当 body（保持 {"error": ...} 的形状），否则包一层。"""
    body = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
    if exc.status_code == 404 and not request.url.path.startswith("/api/"):
        return HTMLResponse(pages.not_found(), status_code=404)
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)


@app.get("/healthz")
def healthz():
    return {"ok": True, "app": "bide"}
