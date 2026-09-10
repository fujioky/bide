"""把旧系统（blog 持久卷 /data 的备份，仓库里的 seed/bide）灌进 SQLite。

用法：python -m bide.migrate <seed目录>
幂等：跑第二次只补缺的，不覆盖已有的用户数据。
旧键 `lyra/<email>` → 用户按 email 建（sub 留空，首次 SSO 登录时认领）。
"""
import json
import sys
import time
from pathlib import Path
from urllib.parse import unquote

from sqlalchemy import select

from .config import settings
from .db import SessionLocal, init_db
from . import auth  # register shared session table before creating foreign keys
from .models import KV, Audit, MarketMeta, Order, Read, User, UserList, Visit


def _load(p: Path, default):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


def uid_to_email(fname: str) -> str | None:
    """文件名形如 lyra%2Fuser%40example.com.json → user@example.com；built-in/admin 这类跳过。"""
    uid = unquote(fname[:-5]) if fname.endswith(".json") else unquote(fname)
    org, _, name = uid.partition("/")
    if not name or "@" not in name:
        return None
    return name.lower()


def get_or_create_user(db, email: str, name: str = "", legacy_uid: str | None = None) -> User:
    u = db.scalar(select(User).where(User.email == email))
    if not u:
        u = User(email=email, name=name or email.split("@")[0], is_admin=email in settings.admin_emails,
                 legacy_uid=legacy_uid)
        db.add(u)
        db.flush()
    return u


def migrate_lists(db, seed: Path, sub: str, kind: str) -> int:
    n = 0
    for f in sorted((seed / sub).glob("*.json")) if (seed / sub).is_dir() else []:
        email = uid_to_email(f.name)
        if not email:
            continue
        u = get_or_create_user(db, email, legacy_uid=unquote(f.name[:-5]))
        if db.get(UserList, (u.id, kind)):
            continue
        syms = [str(s).upper() for s in (_load(f, {}).get("symbols") or [])]
        db.add(UserList(user_id=u.id, kind=kind, symbols=syms))
        n += 1
    return n


def migrate_orders(db, seed: Path) -> int:
    n = 0
    for f in sorted((seed / "orders").glob("*.json")) if (seed / "orders").is_dir() else []:
        email = uid_to_email(f.name)
        if not email:
            continue
        u = get_or_create_user(db, email, legacy_uid=unquote(f.name[:-5]))
        for o in _load(f, {}).get("orders") or []:
            if not o.get("id") or db.get(Order, o["id"]):
                continue
            db.add(Order(id=str(o["id"]), user_id=u.id, sym=str(o.get("sym", "")).upper(),
                         side="sell" if o.get("side") == "sell" else "buy", date=str(o.get("date", "")),
                         qty=float(o.get("qty") or 0), price=float(o.get("price") or 0),
                         note=str(o.get("note") or "")[:80], at=int(o.get("at") or 0)))
            n += 1
    return n


def migrate_reads(db, seed: Path) -> int:
    n = 0
    for f in sorted((seed / "reads").glob("*.json")) if (seed / "reads").is_dir() else []:
        email = uid_to_email(f.name)
        if not email:
            continue
        u = get_or_create_user(db, email, legacy_uid=unquote(f.name[:-5]))
        if db.get(Read, u.id):
            continue
        db.add(Read(user_id=u.id, reads=_load(f, {}).get("reads") or {}))
        n += 1
    return n


def migrate_market(db, seed: Path) -> dict:
    out = {}
    m = seed / "market"
    for kind, fname in (("names", "names.json"), ("analyst", "analyst.json"), ("tags", "tags.json"), ("earnings", "earnings.json")):
        data = _load(m / fname, {})
        c = 0
        for sym, rec in (data or {}).items():
            if not isinstance(rec, dict) or db.get(MarketMeta, (kind, sym)):
                continue
            db.add(MarketMeta(kind=kind, sym=str(sym).upper(), data=rec))
            c += 1
        out[kind] = c
    st = _load(m / "state.json", None)
    if st and not db.get(KV, "market.state"):
        db.add(KV(key="market.state", value=st))
    return out


def migrate_bg(db, seed: Path) -> dict:
    out = {}
    b = seed / "bg"
    vault = _load(b / "vault.json", None)
    if vault and not db.get(KV, "bg.vault"):
        db.add(KV(key="bg.vault", value=vault))
        out["vault"] = list(vault.keys())
    last = _load(b / "last-probe.json", None)
    if last and not db.get(KV, "bg.last_probe"):
        db.add(KV(key="bg.last_probe", value=last))
        out["last_probe"] = len(last)
    log = b / "orders.log"
    if log.is_file() and not db.scalar(select(Audit.id).limit(1)):
        c = 0
        for line in log.read_text(encoding="utf-8").splitlines():
            try:
                rec = json.loads(line)
            except Exception:  # noqa: BLE001
                continue
            db.add(Audit(kind="bg_order", rec=rec))
            c += 1
        out["audit"] = c
    return out


def migrate_notify(db, seed: Path) -> int:
    st = _load(seed / "notify" / "state.json", {})
    n = 0
    for uid, v in (st.get("users") or {}).items():
        email = uid_to_email(uid)
        if not email or not isinstance(v, dict):
            continue
        u = get_or_create_user(db, email, name=str(v.get("name") or ""), legacy_uid=uid)
        if db.get(Visit, u.id):
            continue
        db.add(Visit(user_id=u.id, first=int(v.get("first") or 0), count=int(v.get("count") or 0),
                     last=int(v.get("last") or 0), last_mail=int(v.get("lastMail") or 0),
                     last_seen=int(v.get("lastSeen") or 0), url=str(v.get("url") or "")[:200],
                     reg_mailed=int(v.get("regMailed") or 0)))
        n += 1
    stats = {k: st.get(k, 0) for k in ("sent", "failed")}
    if not db.get(KV, "notify.stats"):
        db.add(KV(key="notify.stats", value=stats))
    return n


def main(seed_dir: str) -> dict:
    seed = Path(seed_dir)
    if not seed.is_dir():
        raise SystemExit(f"seed 目录不存在: {seed}")
    init_db()
    db = SessionLocal()
    try:
        r = {
            "watch": migrate_lists(db, seed, "watchlist", "watch"),
            "flags": migrate_lists(db, seed, "flags", "flag"),
            "orders": migrate_orders(db, seed),
            "reads": migrate_reads(db, seed),
            "market": migrate_market(db, seed),
            "bg": migrate_bg(db, seed),
            "visits": migrate_notify(db, seed),
        }
        db.commit()
        r["users"] = [(u.email, u.is_admin) for u in db.scalars(select(User))]
        r["at"] = int(time.time())
        return r
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    print(json.dumps(main(sys.argv[1]), ensure_ascii=False, indent=1))
