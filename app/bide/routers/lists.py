"""关注列表 / 星标 / 已读 / 订单。接口路径与返回形状与旧看板前端一致。"""
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_user
from ..db import get_db
from ..models import Order, Read, User, UserList

router = APIRouter()
NO_STORE = {"cache-control": "no-store"}

SYM = re.compile(r"^\^?[A-Z][A-Z0-9.\-]{0,9}$")      # 关注列表允许指数（^IXIC）
SYM_NOIDX = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def ok_sym(s) -> bool:
    return bool(SYM.match(str(s or "")))


def clean_symbols(raw, pattern=SYM, limit=60) -> list[str]:
    seen, out = set(), []
    for x in raw or []:
        v = str(x or "").strip().upper()
        if not pattern.match(v) or v in seen:
            continue
        seen.add(v)
        out.append(v)
        if len(out) >= limit:
            break
    return out


def get_list(db: Session, user_id: int, kind: str) -> list[str]:
    row = db.get(UserList, (user_id, kind))
    return list(row.symbols or []) if row else []


def set_list(db: Session, user_id: int, kind: str, symbols: list[str]) -> None:
    row = db.get(UserList, (user_id, kind))
    if row:
        row.symbols = symbols
    else:
        db.add(UserList(user_id=user_id, kind=kind, symbols=symbols))
    db.commit()


def all_watched(db: Session) -> list[str]:
    """所有用户关注的并集（市场元数据每日刷新用）。"""
    out = set()
    for row in db.scalars(select(UserList).where(UserList.kind == "watch")):
        for s in row.symbols or []:
            if ok_sym(s):
                out.add(str(s).upper())
    return sorted(out)


async def _body(request: Request) -> dict:
    try:
        b = await request.json()
    except Exception:  # noqa: BLE001
        return {}
    return b if isinstance(b, dict) else {}


@router.get("/api/watchlist")
def watch_get(u: User = Depends(require_user), db: Session = Depends(get_db)):
    return JSONResponse({"symbols": get_list(db, u.id, "watch")}, headers=NO_STORE)


@router.put("/api/watchlist")
async def watch_put(request: Request, u: User = Depends(require_user), db: Session = Depends(get_db)):
    b = await _body(request)
    if not isinstance(b.get("symbols", []), list):
        raise HTTPException(400, {"error": "symbols 要是数组"})
    out = clean_symbols(b.get("symbols"))
    set_list(db, u.id, "watch", out)
    return {"ok": True, "symbols": out}


@router.get("/api/flags")
def flags_get(u: User = Depends(require_user), db: Session = Depends(get_db)):
    return JSONResponse({"symbols": get_list(db, u.id, "flag")}, headers=NO_STORE)


@router.put("/api/flags")
async def flags_put(request: Request, u: User = Depends(require_user), db: Session = Depends(get_db)):
    b = await _body(request)
    if not isinstance(b.get("symbols", []), list):
        raise HTTPException(400, {"error": "symbols 要是数组"})
    out = clean_symbols(b.get("symbols"), SYM_NOIDX)
    set_list(db, u.id, "flag", out)
    return {"ok": True, "symbols": out}


@router.get("/api/reads")
def reads_get(u: User = Depends(require_user), db: Session = Depends(get_db)):
    row = db.get(Read, u.id)
    return JSONResponse({"reads": dict(row.reads or {}) if row else {}}, headers=NO_STORE)


@router.put("/api/reads")
async def reads_put(request: Request, u: User = Depends(require_user), db: Session = Depends(get_db)):
    b = await _body(request)
    raw = b.get("reads") or {}
    out = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            if ok_sym(k) and DATE.match(str(v or "")):
                out[str(k)] = str(v)
                if len(out) >= 200:
                    break
    row = db.get(Read, u.id)
    if row:
        row.reads = out
    else:
        db.add(Read(user_id=u.id, reads=out))
    db.commit()
    return {"ok": True, "reads": out}


def _order_dict(o: Order) -> dict:
    return {"id": o.id, "sym": o.sym, "side": o.side, "date": o.date, "qty": o.qty,
            "price": o.price, "note": o.note or "", "at": o.at}


def list_orders(db: Session, user_id: int) -> list[dict]:
    rows = db.scalars(select(Order).where(Order.user_id == user_id)).all()
    rows.sort(key=lambda o: (o.date, o.at or 0))
    return [_order_dict(o) for o in rows]


@router.get("/api/orders")
def orders_get(u: User = Depends(require_user), db: Session = Depends(get_db)):
    return JSONResponse({"orders": list_orders(db, u.id)}, headers=NO_STORE)


@router.post("/api/orders")
async def orders_post(request: Request, u: User = Depends(require_user), db: Session = Depends(get_db)):
    b = await _body(request)
    sym = str(b.get("sym") or "").strip().upper()
    side = "sell" if b.get("side") == "sell" else "buy"
    try:
        qty, price = float(b.get("qty")), float(b.get("price"))
    except (TypeError, ValueError):
        qty = price = float("nan")
    if not ok_sym(sym):
        raise HTTPException(400, {"error": "代码格式不对"})
    if not DATE.match(str(b.get("date") or "")):
        raise HTTPException(400, {"error": "日期要是 YYYY-MM-DD"})
    if not (qty == qty and qty > 0 and qty != float("inf")):
        raise HTTPException(400, {"error": "股数要是正数"})
    if not (price == price and price > 0 and price != float("inf")):
        raise HTTPException(400, {"error": "价格要是正数"})
    n = len(db.scalars(select(Order.id).where(Order.user_id == u.id)).all())
    if n >= 2000:
        raise HTTPException(400, {"error": "订单太多了"})
    one = Order(id=uuid.uuid4().hex[:8], user_id=u.id, sym=sym, side=side, date=str(b["date"]),
                qty=round(qty * 1e6) / 1e6, price=round(price * 1e4) / 1e4,
                note=str(b.get("note") or "")[:80], at=int(time.time() * 1000))
    db.add(one)
    db.commit()
    return {"ok": True, "order": _order_dict(one), "orders": list_orders(db, u.id)}


@router.delete("/api/orders/{oid}")
def orders_delete(oid: str, u: User = Depends(require_user), db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o or o.user_id != u.id:
        raise HTTPException(404, {"error": "没有这条订单"})
    db.delete(o)
    db.commit()
    return {"ok": True, "orders": list_orders(db, u.id)}
