"""有人打开看板 / 上线 / 首次登录时给管理员发邮件；管理员页 /online 看谁在线。
发信直连 SMTP（services.mailer）。每用户的节流状态在 visits 表。"""
import time
from datetime import datetime, timezone, timedelta
from html import escape as esc

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from sqlalchemy.orm import Session

from ..auth import current_user, require_admin
from ..config import settings
from ..db import SessionLocal, get_db
from ..models import KV, User, Visit
from ..services import mailer

router = APIRouter()
ONLINE_MS = 120_000
_live: dict[int, dict] = {}     # user_id -> {name,url,title,at,since,ip,ua}


def _fmt(ms: int, tz: timezone, label: str) -> str:
    return datetime.fromtimestamp(ms / 1000, tz).strftime("%Y/%m/%d %H:%M") + " " + label


def both_tz(ms: int) -> str:
    return _fmt(ms, timezone(timedelta(hours=8)), "北京") + " / " + _fmt(ms, timezone(timedelta(hours=-4)), "美东")


def _row(k, v) -> str:
    return f'<tr><td style="color:#718096;white-space:nowrap">{esc(str(k))}</td><td><b>{esc(str(v))}</b></td></tr>'


def _shell(rows: str, foot: str = "") -> str:
    f = f'<p style="color:#718096;font-size:12px;margin-top:14px">{foot}</p>' if foot else ""
    return (f'<div style="font:14px/1.7 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#1a202c">'
            f'<table cellpadding="6" style="border-collapse:collapse">{rows}</table>{f}</div>')


def _stat(db: Session, key: str, delta: int) -> None:
    kv = db.get(KV, "notify.stats") or KV(key="notify.stats", value={})
    v = dict(kv.value or {})
    v[key] = int(v.get(key, 0)) + delta
    kv.value = v
    db.add(kv)


def _send(db: Session, subject: str, html: str, to: list[str] | None = None) -> dict:
    r = mailer.send(subject, html, to)
    _stat(db, "sent" if r.get("ok") else "failed", 1)
    if not r.get("ok"):
        kv = db.get(KV, "notify.stats")
        v = dict(kv.value or {}); v["lastError"] = str(r.get("why", ""))[:200]; kv.value = v
    db.commit()
    return r


def _visit_row(db: Session, u: User) -> Visit:
    v = db.get(Visit, u.id)
    if not v:
        v = Visit(user_id=u.id, first=int(time.time() * 1000))
        db.add(v)
    return v


def _skip(u: User) -> bool:
    return u.email.lower() in settings.notify_skip


def _ip_ua(request: Request) -> tuple[str, str]:
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "")
    return ip, (request.headers.get("user-agent") or "")[:200]


def visit(request: Request, u: User, db: Session) -> None:
    """由 /dashboard 调用：记一次使用，同一账号 GAP 分钟内只发一封。"""
    if not settings.notify_to or _skip(u):
        return
    now = int(time.time() * 1000)
    v = _visit_row(db, u)
    prev, first = v.last, v.count == 0
    v.count += 1
    v.last = now
    gap = settings.notify_gap_min * 60_000
    if now - v.last_mail < gap:
        db.commit()
        return
    v.last_mail = now
    db.commit()
    ip, ua = _ip_ua(request)
    html = _shell(_row("账号", u.email) + _row("显示名", u.name or "—") + _row("时间", both_tz(now))
                  + _row("累计打开", f"{v.count} 次") + _row("上次打开", both_tz(prev) if prev else "—")
                  + _row("IP", ip) + _row("浏览器", ua), f"同一账号 {settings.notify_gap_min} 分钟内只发这一封。")
    _send(db, f"bide 看板 · {u.name or u.email} {'首次打开' if first else '正在使用'}", html)


def registered(request: Request, u: User, created: bool) -> None:
    """auth 的登录钩子：新建账号发一封注册通知。"""
    if not created or not settings.notify_to:
        return
    db = SessionLocal()
    try:
        v = _visit_row(db, u)
        if v.reg_mailed:
            return
        v.reg_mailed = int(time.time() * 1000)
        db.commit()
        ip, _ = _ip_ua(request)
        html = _shell(_row("账号", u.email) + _row("显示名", u.name or "—") + _row("时间", both_tz(v.reg_mailed))
                      + _row("IP", ip), "首次通过 SSO 登录 bide。")
        _send(db, f"bide 新用户 · {u.name or u.email}", html)
    finally:
        db.close()


BEACON = '<script src="/presence.js" defer></script>'


def inject(html: str) -> str:
    return html.replace("</body>", BEACON + "</body>", 1) if "</body>" in html else html + BEACON


@router.get("/presence.js")
def presence_js():
    js = ("(function(){var t=null;function beat(){fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},"
          "body:JSON.stringify({url:location.pathname+location.search,title:document.title}),keepalive:true})"
          ".then(function(r){if(!r.ok&&t){clearInterval(t);t=null;}}).catch(function(){});}\n"
          "beat();t=setInterval(function(){if(!document.hidden)beat();},45000);"
          "document.addEventListener('visibilitychange',function(){if(!document.hidden&&t)beat();});})();")
    return Response(js, media_type="application/javascript; charset=utf-8",
                    headers={"cache-control": "no-cache, must-revalidate"})


@router.post("/api/presence")
async def presence(request: Request, u: User | None = Depends(current_user), db: Session = Depends(get_db)):
    if not u:
        return JSONResponse({"ok": False}, status_code=401)
    now = int(time.time() * 1000)
    try:
        b = await request.json()
    except Exception:  # noqa: BLE001
        b = {}
    b = b if isinstance(b, dict) else {}
    url, title = str(b.get("url") or "")[:200], str(b.get("title") or "")[:120]
    v = _visit_row(db, u)
    prev = _live.get(u.id)
    back = not prev or now - prev["at"] > ONLINE_MS
    ip, ua = _ip_ua(request)
    _live[u.id] = {"name": u.name or u.email, "email": u.email, "url": url, "title": title, "at": now,
                   "since": now if back else prev["since"], "ip": ip, "ua": ua}
    v.last_seen, v.url = now, url
    gap = settings.notify_gap_min * 60_000
    if back and not _skip(u) and settings.notify_to and now - v.last_mail >= gap:
        v.last_mail = now
        db.commit()
        full = settings.base_url + url
        _send(db, f"bide · {u.name or u.email} 上线", _shell(
            _row("账号", u.email) + _row("显示名", u.name or "—") + _row("正在看", title or "—")
            + f'<tr><td style="color:#718096">页面</td><td><a href="{esc(full)}">{esc(url)}</a></td></tr>'
            + _row("时间", both_tz(now)) + _row("IP", ip) + _row("浏览器", ua),
            f"离线超过 {settings.notify_gap_min} 分钟再回来才算一次新的上线；在线名单看 {settings.base_url}/online。"))
    else:
        db.commit()
    return {"ok": True}


def snapshot(db: Session) -> dict:
    now = int(time.time() * 1000)
    online = []
    for uid, v in list(_live.items()):
        if now - v["at"] > ONLINE_MS:
            _live.pop(uid, None)
            continue
        online.append({"uid": v["email"], "name": v["name"], "url": v["url"], "title": v["title"],
                       "agoSec": round((now - v["at"]) / 1000), "sinceMin": round((now - v["since"]) / 60000),
                       "ip": v["ip"], "ua": v["ua"]})
    online.sort(key=lambda x: x["agoSec"])
    recent = []
    for v in db.query(Visit).all():
        if v.last_seen and now - v.last_seen < 86_400_000:
            u = db.get(User, v.user_id)
            recent.append({"uid": u.email if u else str(v.user_id), "name": (u.name or u.email) if u else "?",
                           "url": v.url or "", "agoMin": round((now - v.last_seen) / 60000), "count": v.count})
    recent.sort(key=lambda x: x["agoMin"])
    return {"at": now, "online": online, "recent": recent}


@router.get("/api/presence/list")
def presence_list(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return snapshot(db)


@router.get("/api/notify/test")
def notify_test(to: str | None = None, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    dst = [s.strip() for s in to.split(",")] if to else None
    now = int(time.time() * 1000)
    return _send(db, "bide 通知自检", _shell(_row("时间", both_tz(now)) + _row("收件", ", ".join(dst or settings.notify_to))), dst)


@router.get("/api/notify/state")
def notify_state(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    kv = db.get(KV, "notify.stats")
    st = dict(kv.value or {}) if kv else {}
    users = {}
    for v in db.query(Visit).all():
        u = db.get(User, v.user_id)
        users[u.email if u else v.user_id] = {"first": v.first, "count": v.count, "last": v.last,
                                              "lastMail": v.last_mail, "lastSeen": v.last_seen, "url": v.url}
    return {"to": settings.notify_to, "smtp": mailer.ready(), "gapMin": settings.notify_gap_min,
            "skip": sorted(settings.notify_skip), "sent": st.get("sent", 0), "failed": st.get("failed", 0),
            "lastError": st.get("lastError"), "users": users}


ONLINE_HTML = """<!DOCTYPE html>
<html lang="zh-CN" data-lyra-theme="data"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>谁在线 · bide</title>
<link rel="stylesheet" href="/ds/ds-runtime.css">
<style>
body{font:15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:0 auto;padding:24px 18px;
 background:var(--surface-page,#fff);color:var(--text-body,#2d3748)}
h1{font-size:20px;margin:0 0 2px}.sub{color:var(--text-muted,#718096);font-size:13px;margin:0 0 20px}
.card{border:1px solid var(--border-hairline,#e2e8f0);border-radius:10px;padding:12px 14px;margin-bottom:10px;
 background:var(--surface-raised,#f7fafc)}
.nm{font-weight:600}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#38a169;margin-right:7px}
.u{font-family:ui-monospace,monospace;font-size:13px;color:var(--link,#3182ce);word-break:break-all}
.meta{color:var(--text-muted,#718096);font-size:12px;margin-top:4px}
h2{font-size:15px;margin:26px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 6px;border-bottom:1px solid var(--border-hairline,#edf2f7)}
.empty{color:var(--text-muted,#718096);font-size:14px}
</style></head><body>
<h1>谁在线</h1><p class="sub">页面每 10 秒刷新一次；心跳 45 秒一报，超过 2 分钟没消息算离线。未登录的访客不计入。</p>
<div id="on"></div><h2>最近 24 小时</h2><div id="rc"></div>
<script>
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
async function tick(){
 try{var d=await (await fetch('/api/presence/list',{cache:'no-store'})).json();}catch(e){return}
 document.getElementById('on').innerHTML = d.online.length ? d.online.map(function(o){
   return '<div class="card"><div><span class="dot"></span><span class="nm">'+esc(o.name)+'</span></div>'+
   '<div class="u"><a href="'+esc(o.url)+'">'+esc(o.url)+'</a></div>'+
   '<div class="meta">'+esc(o.title||'')+' · 已在线 '+o.sinceMin+' 分钟 · '+o.agoSec+' 秒前有心跳 · '+esc(o.uid)+' · '+esc(o.ip)+'</div></div>';
 }).join('') : '<p class="empty">此刻没有人在线。</p>';
 document.getElementById('rc').innerHTML = d.recent.length ? '<table>'+d.recent.map(function(r){
   return '<tr><td>'+esc(r.name)+'</td><td class="u">'+esc(r.url)+'</td><td style="text-align:right;white-space:nowrap">'+r.agoMin+' 分钟前</td></tr>';
 }).join('')+'</table>' : '<p class="empty">最近 24 小时没有记录。</p>';
}
tick();setInterval(tick,10000);
</script></body></html>"""


@router.get("/online")
def online(_: User = Depends(require_admin)):
    return HTMLResponse(ONLINE_HTML, headers={"cache-control": "no-store"})
