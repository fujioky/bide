"""Bitget Stock+ 的 HTTP 层：路径、参数、返回形状、状态码与旧 blog/bitget.js 一致。
逻辑全在 services.bitget，这里只做门禁、取参数、把 BgError 转成 HTTPException。

权限：行情（quote / candles）对所有登录用户开放——那是只读的公共市场数据，而且
服务端按 60 秒缓存，多人同时看也只打一次上游。保险箱、探测、交易 key 相关的
一律只有管理员。"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import User
from ..services import bitget as bg

router = APIRouter()
NO_STORE = {"cache-control": "no-store"}
_TPL = Path(__file__).resolve().parent.parent / "templates" / "bg_setup.html"


def require_bg_user(u: User | None = Depends(current_user)) -> User:
    if not u:
        raise HTTPException(401, {"error": "需要登录"})
    return u


def require_bg_admin(u: User | None = Depends(current_user)) -> User:
    """deny 的形状沿用 JS：{"error": "仅管理员"}；没登录的给 401。"""
    if not u:
        raise HTTPException(401, {"error": "需要登录"})
    if not u.is_admin:
        raise HTTPException(403, {"error": "仅管理员"})
    return u


async def _body(request: Request) -> dict:
    try:
        b = await request.json()
    except Exception:  # noqa: BLE001
        return {}
    return b if isinstance(b, dict) else {}


def _raise(e: bg.BgError):
    raise HTTPException(e.status, e.body)


async def shutdown(app) -> None:
    await bg.close_client()


# ── 自检 ────────────────────────────────────────────────────

@router.get("/api/bg/egress")
async def egress(_: User = Depends(require_bg_admin)):
    return await bg.egress()


# ── 保险箱读写 ──────────────────────────────────────────────

@router.get("/api/bg/vault")
def vault_get(_: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    return bg.vault_status(db)


@router.post("/api/bg/vault")
async def vault_post(request: Request, _: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    if not bg.settings.bg_vault_secret:
        raise HTTPException(500, {"error": "缺 BG_VAULT_SECRET，无法加密保存"})
    b = await _body(request)
    slot = "trade" if b.get("slot") == "trade" else "ro"
    pw = bg._js_str(b.get("passphrase")) if b.get("passphrase") else ""
    if not pw:
        raise HTTPException(400, {"error": "缺 passphrase"})
    if len(pw) > 256:
        raise HTTPException(400, {"error": "passphrase 过长"})
    try:
        bg.vault_put(db, slot, pw)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, {"error": str(e) or repr(e)})
    return {"ok": True, "slot": slot}


@router.delete("/api/bg/vault")
def vault_delete(slot: str | None = None, _: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    slot = "trade" if slot == "trade" else "ro"
    try:
        bg.vault_delete(db, slot)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, {"error": str(e) or repr(e)})
    return {"ok": True, "slot": slot}


# ── 只读探测 ────────────────────────────────────────────────

@router.post("/api/bg/probe")
async def probe(request: Request, _: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    """body = {path, query?, passphrase?, slot?, save?}"""
    b = await _body(request)
    try:
        return await bg.probe(db, str(b.get("path") or ""), b.get("query"), b.get("slot"),
                              str(b.get("passphrase") or ""), bool(b.get("save")))
    except bg.BgError as e:
        _raise(e)


@router.get("/api/bg/last")
def last_get(_: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    return bg.last_probe_get(db)


@router.delete("/api/bg/last")
def last_delete(_: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    try:
        bg.last_probe_clear(db)
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True}


# ── 看板行情 ────────────────────────────────────────────────

@router.get("/api/bg/quote")
async def quote(syms: str | None = None, _: User = Depends(require_bg_user), db: Session = Depends(get_db)):
    raw = str(syms or "").strip()
    if not raw:
        raise HTTPException(400, {"error": "缺 syms"})
    try:
        out = await bg.quotes(db, bg.parse_syms(raw))
    except bg.BgError as e:
        _raise(e)
    return JSONResponse(out, headers=NO_STORE)


@router.get("/api/bg/candles")
async def candles(sym: str | None = None, period: str | None = None, count: str | None = None,
                  _: User = Depends(require_bg_user), db: Session = Depends(get_db)):
    try:
        out = await bg.candles(db, sym or "", period, count)
    except bg.BgError as e:
        _raise(e)
    return JSONResponse(out, headers=NO_STORE)


# ── 下单 ────────────────────────────────────────────────────

@router.post("/api/bg/order")
async def order(request: Request, _: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    b = await _body(request)
    try:
        return await bg.place_order(db, b)
    except bg.BgError as e:
        _raise(e)


@router.post("/api/bg/order/cancel")
async def order_cancel(request: Request, _: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    b = await _body(request)
    try:
        return await bg.cancel_order(db, b)
    except bg.BgError as e:
        _raise(e)


@router.get("/api/bg/order/log")
def order_log(_: User = Depends(require_bg_admin), db: Session = Depends(get_db)):
    return JSONResponse(bg.order_log(db), headers=NO_STORE)


# ── 密码输入页 ──────────────────────────────────────────────

@router.get("/bg/setup")
def setup(u: User | None = Depends(current_user)):
    if not u or not u.is_admin:
        return HTMLResponse('<meta charset="utf-8"><p style="font:16px/1.6 system-ui;padding:40px">'
                            '需要用管理员账号登录：<a href="/auth/login?next=/bg/setup">去登录</a></p>',
                            status_code=403)
    return HTMLResponse(_TPL.read_text(encoding="utf-8"), headers=NO_STORE)
