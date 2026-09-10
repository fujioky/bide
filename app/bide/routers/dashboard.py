"""看板页。页面本身是静态 HTML（templates/dashboard.html），服务端只做门禁与注入心跳探针。"""
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import User
from ..pages import gate
from . import notify

router = APIRouter()
_TPL = Path(__file__).resolve().parent.parent / "templates" / "dashboard.html"


@router.get("/")
def home():
    return RedirectResponse("/dashboard", status_code=302)


@router.get("/dashboard")
def dashboard(request: Request, u: User | None = Depends(current_user), db: Session = Depends(get_db)):
    if not u:
        return HTMLResponse(gate("看板", None, "/dashboard"), status_code=403)
    try:
        notify.visit(request, u, db)
    except Exception as e:  # noqa: BLE001
        request.app.logger.warning("notify visit: %s", e) if hasattr(request.app, "logger") else None
    html = _TPL.read_text(encoding="utf-8")
    return HTMLResponse(notify.inject(html), headers={"cache-control": "no-store"})
