"""Bitget Stock+ 接入（移植自 blog/bitget.js，接口形状与安全约束保持一致）。

目标：① 拉成交记录自动对账；② 收盘前按确认过的清单下单；③ 给看板供实时行情。

凭据分两组，来源不同，这是有意的：
  BITGET_KEY    / BITGET_SECRET     交易 key，服务环境变量
  BITGET_RO_KEY / BITGET_RO_SECRET  只读 key，服务环境变量
两者都不进代码不进 Git。行情走只读那把，缺省回落到交易那把。

passphrase 有两种用法：
  · 即时带入（POST /api/bg/probe 的 body）—— 用完即弃，不落盘
  · 存入保险箱（POST /api/bg/vault）—— AES-256-GCM 加密后存 KV 表 key=bg.vault，
    密钥取环境变量 BG_VAULT_SECRET，不落盘。
加密只防「有人读到 .db、备份或 Git 仓库里的文件」。服务器本身被拿下时它必然可解
（要签名就得解），这一点不要指望它。

Bitget 还要求 IP 白名单，所以所有请求必须从本服务器发出，本地或沙箱里调一律
40018（无效的 IP）。

安全约束：通用通道（call / probe）只发 GET，且路径必须以 /api/v3/stockplus/ 开头。
Bitget 的下单/改单/撤单全是 POST，所以那一层在结构上就不可能下单。唯一能动钱的
是 trade_post，它只被 place_order / cancel_order 两条写死的路径调用。

给 MCP 用的纯函数入口（不经 HTTP）：quotes / candles / probe。它们抛 BgError
（带 status 与 body），路由层原样转成 HTTPException。
"""
from __future__ import annotations

import asyncio
import base64
import hmac
import hashlib
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote as _urlquote

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import KV, Audit

HOST = "https://api.bitget.com"
PREFIX = "/api/v3/stockplus/"
KV_VAULT = "bg.vault"
KV_LAST = "bg.last_probe"
AUDIT_KIND = "bg_order"
SYM_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
OID_RE = re.compile(r"^\d{1,32}$")


class BgError(Exception):
    """带 HTTP 状态码的错误；body 就是要回给调用方的 JSON。"""

    def __init__(self, status: int, body: dict | str):
        self.status = status
        self.body = body if isinstance(body, dict) else {"error": str(body)}
        super().__init__(self.body.get("error", str(body)))


# ── 小工具 ──────────────────────────────────────────────────

def _now_ms() -> int:
    return int(time.time() * 1000)


def _iso(dt: datetime | None = None) -> str:
    """JS 的 new Date().toISOString()：毫秒精度、带 Z。传入的 naive datetime 视为 UTC。"""
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _parse_ms(v) -> float:
    """JS 的 new Date(v).getTime()：数字按毫秒，字符串按 ISO；解析不了给 NaN。"""
    if isinstance(v, bool) or v is None:
        return math.nan
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return math.nan
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00") if s.endswith("Z") else s)
    except ValueError:
        return math.nan
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.timestamp() * 1000


def _js_round(x: float) -> int:
    """Math.round：四舍五入（.5 向上），不是 Python 的银行家舍入。"""
    return int(math.floor(x + 0.5))


def _js_number(v) -> float:
    """JS 的 Number(v)。缺失（undefined）→ NaN；null → 0；'' → 0。"""
    if v is _MISSING:
        return math.nan
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return 0.0
        try:
            return float(s)
        except ValueError:
            return math.nan
    return math.nan


_MISSING = object()


def _js_str(v) -> str:
    """JS 的 String(v)：1.0 → '1'、true → 'true'。"""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer() and abs(v) < 2 ** 53:
        return str(int(v))
    if v is None:
        return "null"
    return str(v)


def _num_or_none(x: float | None):
    """JSON 里 NaN/Infinity 会变成 null；整数值不带 .0，跟 JS 的输出一致。"""
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return None
    if isinstance(x, float) and x.is_integer() and abs(x) < 2 ** 53:
        return int(x)
    return x


def _plus(v):
    """JS 的一元 +v，再转成可 JSON 的数。"""
    return _num_or_none(_js_number(_MISSING if v is None else v))


def _sym_ok(s: str) -> bool:
    return bool(SYM_RE.match(s))


# ── 签名与凭据 ──────────────────────────────────────────────

def sign(secret: str, ts: str, method: str, path_with_query: str, body: str = "") -> str:
    """base64(hmac_sha256(secret, timestamp + METHOD + 带 query 的路径 + body))"""
    msg = (ts + method.upper() + path_with_query + body).encode("utf-8")
    return base64.b64encode(hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()).decode("ascii")


def creds(which: str | None = None) -> dict:
    """用哪把 key：默认只读，缺只读时回落到交易那把（并在返回里标出来）。"""
    if which == "trade":
        return {"key": settings.bitget_key, "secret": settings.bitget_secret, "kind": "trade"}
    if settings.bitget_ro_key and settings.bitget_ro_secret:
        return {"key": settings.bitget_ro_key, "secret": settings.bitget_ro_secret, "kind": "ro"}
    return {"key": settings.bitget_key, "secret": settings.bitget_secret, "kind": "trade-fallback"}


def _headers(key: str, secret: str, ts: str, method: str, full: str, body: str = "") -> dict:
    return {
        "ACCESS-KEY": key,
        "ACCESS-SIGN": sign(secret, ts, method, full, body),
        "ACCESS-PASSPHRASE": "",  # 由调用方填
        "ACCESS-TIMESTAMP": ts,
        "locale": "zh-CN",
        "Content-Type": "application/json",
    }


# ── HTTP 客户端（模块级单例，20 秒超时） ───────────────────

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20.0)
    return _client


async def close_client() -> None:
    global _client
    c, _client = _client, None
    if c is not None:
        await c.aclose()


# ── 保险箱：AES-256-GCM ─────────────────────────────────────
# 条目格式 {v:1, slot, at, iv, tag, ct}，各字段 base64，与 Node 版完全一致，
# 所以从旧系统迁过来的 vault.json 原样写进 KV 就能解开。

VAULT_SALT = b"lyra-bg-vault-v1"

# passphrase 有效期。
# trade（下单）12 小时后失效，每天要重新输一次——用户的操作窗口只在收盘与盘后
# 的交界处，12 小时足够覆盖一整天，过了就不该还留在盘上。
# ro（只读行情）不设期限：它只能读市场数据、不能下单，而且看板的实时行情和
# 日内 K 线对所有登录用户开放，一过期全站的行情就断了。
# 要让 ro 也跟着过期，把下面的 None 改成 12 即可。
TTL_H: dict[str, int | None] = {"trade": 12, "ro": None}


def vkey() -> bytes | None:
    """必须与 Node 的 crypto.scryptSync(secret, 'lyra-bg-vault-v1', 32) 默认参数一致：
    N=16384, r=8, p=1。"""
    secret = settings.bg_vault_secret
    if not secret:
        return None
    return Scrypt(salt=VAULT_SALT, length=32, n=16384, r=8, p=1).derive(secret.encode("utf-8"))


def ttl_left(e: dict | None) -> float | None:
    """剩余毫秒；不过期的槽给 inf。"""
    if not e:
        return None
    h = TTL_H.get(e.get("slot"))
    if not h:
        return math.inf
    at = _parse_ms(e.get("at"))
    if math.isnan(at):
        return math.nan
    return h * 3600e3 - (_now_ms() - at)


def _expired(left) -> bool:
    """JS 里 ttlLeft(...) <= 0；NaN 比较恒为 false，所以解析不了 at 的条目不算过期。"""
    return left is not None and not (isinstance(left, float) and math.isnan(left)) and left <= 0


def vault_raw(db: Session) -> dict:
    row = db.get(KV, KV_VAULT)
    return dict(row.value or {}) if row else {}


def _vault_write(db: Session, all_: dict) -> None:
    row = db.get(KV, KV_VAULT)
    if not all_:
        if row:
            db.delete(row)
    elif row:
        row.value = all_
    else:
        db.add(KV(key=KV_VAULT, value=all_))
    db.commit()


def vault_put(db: Session, slot: str, plain: str) -> None:
    k = vkey()
    if not k:
        raise RuntimeError("缺 BG_VAULT_SECRET")
    iv = os.urandom(12)
    sealed = AESGCM(k).encrypt(iv, plain.encode("utf-8"), None)
    ct, tag = sealed[:-16], sealed[-16:]
    all_ = vault_raw(db)
    all_[slot] = {
        "v": 1,
        "slot": slot,
        "at": _iso(),
        "iv": base64.b64encode(iv).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
        "ct": base64.b64encode(ct).decode("ascii"),
    }
    _vault_write(db, all_)


def vault_get(db: Session, slot: str) -> str | None:
    k = vkey()
    if not k:
        return None
    e = vault_raw(db).get(slot)
    if not isinstance(e, dict) or e.get("v") != 1:
        return None
    if _expired(ttl_left({**e, "slot": slot})):
        return None  # 过期就当没存
    try:
        iv = base64.b64decode(e["iv"])
        ct = base64.b64decode(e["ct"]) + base64.b64decode(e["tag"])
        return AESGCM(k).decrypt(iv, ct, None).decode("utf-8")
    except Exception:  # noqa: BLE001  换过 BG_VAULT_SECRET 就解不开，当没存
        return None


def vault_delete(db: Session, slot: str) -> None:
    all_ = vault_raw(db)
    all_.pop(slot, None)
    _vault_write(db, all_)


def vault_status(db: Session) -> dict:
    """只回状态，永远不回明文。"""
    raw = vault_raw(db)
    out: dict = {"hasVaultSecret": bool(settings.bg_vault_secret), "slots": {}}
    for s in ("ro", "trade"):
        e = raw.get(s)
        if not e:
            out["slots"][s] = {"saved": False, "ttlHours": TTL_H[s]}
            continue
        left = ttl_left({**e, "slot": s})
        out["slots"][s] = {
            "saved": True, "at": e.get("at"), "ttlHours": TTL_H[s],
            "expired": _expired(left),
            "leftMin": None if left == math.inf else max(0, _js_round(left / 60000)) if not math.isnan(left) else None,
            "readable": vault_get(db, s) is not None,
        }
    return out


def import_legacy_vault(db: Session, obj: dict) -> None:
    """把旧 /data/bg/vault.json 的整个对象原样写入 KV（条目格式相同，直接可解）。"""
    _vault_write(db, dict(obj or {}))


# ── 发一次已签名的 GET ──────────────────────────────────────

def build_query(query) -> str:
    """不能用 urlencode：它会把标的列表里的逗号编成 %2C，而 Bitget 先解码再验签，
    于是多标的查询一律 40009。手工拼，逗号原样留着。"""
    if not isinstance(query, dict):
        return ""

    def enc(x) -> str:
        return _urlquote(_js_str(x), safe="-_.!~*'()").replace("%2C", ",")

    parts = []
    for k, v in query.items():
        if isinstance(v, list):
            parts.extend(enc(k) + "=" + enc(x) for x in v)
        elif v is not None and v != "":
            parts.append(enc(k) + "=" + enc(v))
    return "&".join(parts)


async def call(path: str, query=None, pass_: str = "", which: str | None = None) -> dict:
    c = creds(which)
    key, secret, kind = c["key"], c["secret"], c["kind"]
    if not key or not secret:
        return {"status": 0, "error": "缺 key/secret（" + kind + "）"}
    qs = build_query(query)
    full = path + ("?" + qs if qs else "")
    ts = str(_now_ms())
    h = _headers(key, secret, ts, "GET", full)
    h["ACCESS-PASSPHRASE"] = pass_
    try:
        r = await get_client().get(HOST + full, headers=h, timeout=20.0)
        text = r.text
        try:
            j = json.loads(text)
        except ValueError:
            j = None
        return {"status": r.status_code, "keyKind": kind, "path": full,
                "body": j if j is not None else text[:4000]}
    except Exception as e:  # noqa: BLE001
        return {"status": 0, "keyKind": kind, "path": full, "error": str(e) or repr(e)}


# ── 自检 ────────────────────────────────────────────────────

async def egress() -> dict:
    out: dict = {}
    for name, url in (("ipify", "https://api.ipify.org"), ("icanhazip", "https://icanhazip.com")):
        try:
            r = await get_client().get(url, timeout=8.0)
            out[name] = r.text.strip()
        except Exception as e:  # noqa: BLE001
            out[name] = "ERR " + (str(e) or repr(e))
    out["hasKey"] = bool(settings.bitget_key)
    out["hasSecret"] = bool(settings.bitget_secret)
    out["hasRoKey"] = bool(settings.bitget_ro_key)
    out["hasRoSecret"] = bool(settings.bitget_ro_secret)
    out["hasVaultSecret"] = bool(settings.bg_vault_secret)
    return out


# ── 只读探测 ────────────────────────────────────────────────

def last_probe_get(db: Session) -> dict:
    row = db.get(KV, KV_LAST)
    return dict(row.value or {}) if row else {}


def last_probe_clear(db: Session) -> None:
    row = db.get(KV, KV_LAST)
    if row:
        row.value = {}
        db.commit()


async def probe(db: Session, path: str, query=None, slot: str = "ro",
                passphrase: str = "", save: bool = False) -> dict:
    """不带 passphrase 时用保险箱里的。出错抛 BgError（400 / 502）。"""
    path = str(path or "")
    if not path.startswith(PREFIX):
        raise BgError(400, "只允许 " + PREFIX + " 下的路径")
    if ".." in path:
        raise BgError(400, "路径不合法")
    slot = "trade" if slot == "trade" else "ro"
    pass_ = str(passphrase or "") or vault_get(db, slot) or ""
    if not pass_:
        raise BgError(400, "没带 passphrase，保险箱里也没有（slot=" + slot + "）")
    out = await call(path, query, pass_, slot)
    if out.get("status") == 0 and out.get("error"):
        raise BgError(502, out)
    if save:
        try:
            prev = last_probe_get(db)
            prev[path] = {"at": _iso(), **out}
            row = db.get(KV, KV_LAST)
            if row:
                row.value = prev
            else:
                db.add(KV(key=KV_LAST, value=prev))
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
    return out


# ── 看板行情 ────────────────────────────────────────────────
# Bitget 只读行情固定滞后约 15 分钟（实测 900±10 秒，LV1 实时卡只在 APP 里生效、
# Open API 拿不到），所以服务端缓存 60 秒是白赚的：对新鲜度毫无损失，却把上游
# 请求数压到每分钟最多一次。另外限频是「1 秒 10 次、并发 5」，缓存同时兜住了
# 多人同时刷。

QTTL_MS = 60 * 1000
_QCACHE: dict[str, dict] = {}       # 代码 → {at, q}
_q_inflight: asyncio.Future | None = None
NO_RO_PASS = "保险箱里没有只读 passphrase，去 /bg/setup 存一次"


def parse_syms(raw: str) -> list[str]:
    seen, out = set(), []
    for s in str(raw or "").split(","):
        v = s.strip().upper()
        if _sym_ok(v) and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _fresh(c: str, now: int):
    e = _QCACHE.get(c)
    return e if e and now - e["at"] < QTTL_MS else None


async def _fetch_quotes(db: Session, still: list[str]) -> None:
    pass_ = vault_get(db, "ro")
    if not pass_:
        raise RuntimeError(NO_RO_PASS)
    # 分隔符必须是裸逗号，见 build_query 的注释
    path = PREFIX + "market/quote"
    full = path + "?symbol=" + ",".join(c + ".US" for c in still)
    c = creds("ro")
    ts = str(_now_ms())
    h = _headers(c["key"], c["secret"], ts, "GET", full)
    h["ACCESS-PASSPHRASE"] = pass_
    r = await get_client().get(HOST + full, headers=h, timeout=20.0)
    j = r.json()
    if not isinstance(j, dict) or j.get("code") != "00000":
        code = j.get("code") if isinstance(j, dict) else None
        msg = (j.get("msg") if isinstance(j, dict) else None) or ""
        raise RuntimeError(f"{code} {msg}")
    at = _now_ms()
    for x in ((j.get("data") or {}).get("list") or []):
        sym = re.sub(r"\.US$", "", str(x.get("symbol")))
        _QCACHE[sym] = {"at": at, "q": x}
    # 上游没回的（下市、代码写错、非美股）也占个位，否则每次请求都会为它再打一次上游。
    for c_ in still:
        e = _QCACHE.get(c_)
        if not e or e["at"] != at:
            _QCACHE[c_] = {"at": at, "q": None}


def _trim(o):
    if not o:
        return None
    return {"last": o.get("lastDone"), "ts": o.get("timestamp"), "high": o.get("high"),
            "low": o.get("low"), "vol": o.get("volume"), "prev": o.get("prevClose")}


def _shape_quote(c: str, e: dict, now: int) -> dict | None:
    q = e.get("q")
    if not q:
        return None
    # 主时段收盘后 lastDone 是收盘价，盘前/盘后/夜盘各自另算，看板要的
    # 「现在多少钱」取三者里时间戳最新的那个。
    regular = {"lastDone": q.get("lastDone"), "timestamp": q.get("timestamp"), "high": q.get("high"),
               "low": q.get("low"), "volume": q.get("volume"), "prevClose": q.get("prevClose")}
    cands = [("regular", regular), ("pre", q.get("preMarketQuote")),
             ("post", q.get("postMarketQuote")), ("on", q.get("overnightQuote"))]
    # 盘前/盘后/夜盘那一档在还没有成交时，Bitget 会给 lastDone: 0 而不是 null，
    # 时间戳却是时段开始时间。不挡掉 0 的话它会被当成「最新价」，看板上就是 -100%。
    sess = [(n, v) for n, v in cands
            if isinstance(v, dict) and _js_number(v.get("lastDone", _MISSING)) > 0 and v.get("timestamp")]
    sess.sort(key=lambda nv: -_parse_ms(nv[1]["timestamp"]) if not math.isnan(_parse_ms(nv[1]["timestamp"])) else 0)
    name, cur = sess[0] if sess else ("regular", None)
    # 涨跌幅的基准必须取当前时段自己的 prevClose：盘前那一档的 prevClose 是昨天的
    # 收盘，而顶层 prevClose 是前天的收盘。拿盘前价去比顶层 prevClose 会把昨天
    # 一整天的涨跌重复算一遍。
    base = cur.get("prevClose") if (cur and cur.get("prevClose") is not None) else q.get("prevClose")
    age = None
    if cur:
        t = _parse_ms(cur.get("timestamp"))
        age = _js_round((now - t) / 1000) if not math.isnan(t) else None
    chg = None
    if cur and base not in (None, "", 0, False):
        b, last = _js_number(base), _js_number(cur.get("lastDone"))
        if b and math.isfinite(b) and math.isfinite(last):
            chg = float(f"{(last - b) / b * 100:.2f}")
    return {
        "last": cur.get("lastDone") if cur else None,
        "session": name,                        # regular / pre / post / on
        "ts": cur.get("timestamp") if cur else None,
        "ageSec": age,
        "prevClose": base,
        "chgPct": chg,
        "close": q.get("lastDone"),             # 主时段收盘（或最新成交）
        "closeTs": q.get("timestamp"),
        "open": q.get("open"), "high": q.get("high"), "low": q.get("low"), "vol": q.get("volume"),
        "status": q.get("tradeStatus"),
        "pre": _trim(q.get("preMarketQuote")), "post": _trim(q.get("postMarketQuote")),
        "on": _trim(q.get("overnightQuote")),
        "cachedSec": _js_round((now - e["at"]) / 1000),
    }


async def quotes(db: Session, codes: list[str]) -> dict:
    """看板行情。codes 是已大写的代码列表（不带 .US）；非法的会被丢掉。"""
    global _q_inflight
    codes = parse_syms(",".join(str(c) for c in codes))
    if not codes:
        raise BgError(400, "syms 里没有合法代码")
    if len(codes) > 400:
        raise BgError(400, "一次最多 400 只")

    now = _now_ms()
    miss = [c for c in codes if _fresh(c, now) is None]
    if miss:
        # 同一时刻只允许一次上游请求，后来的等前一次
        if _q_inflight is not None:
            try:
                await _q_inflight
            except Exception:  # noqa: BLE001
                pass
        still = [c for c in codes if _fresh(c, now) is None]
        if still:
            task = asyncio.ensure_future(_fetch_quotes(db, still))
            _q_inflight = task
            try:
                await task
            except Exception as e:  # noqa: BLE001
                _q_inflight = None
                raise BgError(502, str(e) or repr(e))
            _q_inflight = None

    out: dict = {}
    oldest = 0
    now = _now_ms()
    for c in codes:
        e = _QCACHE.get(c)
        if not e or not e.get("q"):
            out[c] = None
            continue
        shaped = _shape_quote(c, e, now)
        out[c] = shaped
        if shaped and shaped["ageSec"] is not None and shaped["ageSec"] > oldest:
            oldest = shaped["ageSec"]
    return {"at": _iso(), "maxAgeSec": oldest, "quotes": out}


# ── 日内 K 线 ───────────────────────────────────────────────
# GET /api/bg/candles?sym=NVDA&period=Min_2&count=1000
# 两个实测出来的约束写在这里，改的时候别丢：
#   · tradeSessions 只接受 Intraday 和 All 两个值。文档列的 Pre/Post/Overnight
#     单独传、逗号组合传、小写传，一律 400172 参数校验失败；写成单数
#     tradeSession 会被当未知参数忽略、静默只回盘中。
#   · 夜盘（美东 20:00–04:00）一根都拿不到——它属于 LV1 档，而 LV1 行情卡只在
#     Bitget APP 里生效。实测五只标的三天 5000 根，UTC 00:00–08:00 为空。所以能
#     画的是 Pre+Intraday+Post 共 16 小时，每个交易日 480 根 Min_2。前端按
#     「时间轴跳过夜盘」处理。
# 复权固定 NoAdjust：前复权会改动历史价，日内图要跟订单成交价对得上。

PERIODS = ["Min_1", "Min_2", "Min_3", "Min_5", "Min_10", "Min_15",
           "Min_20", "Min_30", "Min_60", "Min_120", "Day"]
_CCACHE: dict[str, dict] = {}       # sym|period|count → {at, bars}
_SESS = {"Pre": "p", "Intraday": "r", "Post": "o", "Overnight": "n"}
_INT_RE = re.compile(r"^\s*[+-]?\d+")


def norm_period(p) -> str:
    p = str(p or "Min_2")
    return p if p in PERIODS else "Min_2"


def norm_count(v) -> int:
    """JS：Math.min(1000, Math.max(10, parseInt(count, 10) || 1000))"""
    m = _INT_RE.match(str(v)) if v is not None else None
    n = int(m.group(0)) if m else 0
    return min(1000, max(10, n or 1000))


def _bar_ms(v) -> float:
    """分钟线的 timestamp 是 ISO 字符串，日线才是秒——统一转成毫秒。"""
    n = _js_number(_MISSING if v is None else v)
    if math.isfinite(n):
        return n if n > 2e10 else n * 1000
    return _parse_ms(v)


async def candles(db: Session, sym: str, period: str = "Min_2", count=1000) -> dict:
    sym = str(sym or "").strip().upper()
    period = norm_period(period)
    count = norm_count(count)
    if not _sym_ok(sym):
        raise BgError(400, "sym 不合法")

    ck = f"{sym}|{period}|{count}"
    hit = _CCACHE.get(ck)
    now = _now_ms()
    if hit and now - hit["at"] < QTTL_MS:
        return {"sym": sym, "period": period, "cachedSec": _js_round((now - hit["at"]) / 1000), "bars": hit["bars"]}
    pass_ = vault_get(db, "ro")
    if not pass_:
        raise BgError(400, NO_RO_PASS)

    # 分隔符与参数顺序都要跟签名串一致，手工拼
    full = (PREFIX + "market/candlestick?symbol=" + sym + ".US&period=" + period +
            "&count=" + str(count) + "&adjustType=NoAdjust&tradeSessions=All")
    c = creds("ro")
    ts = str(_now_ms())
    h = _headers(c["key"], c["secret"], ts, "GET", full)
    h["ACCESS-PASSPHRASE"] = pass_
    try:
        r = await get_client().get(HOST + full, headers=h, timeout=20.0)
        j = r.json()
        if not isinstance(j, dict) or j.get("code") != "00000":
            code = j.get("code") if isinstance(j, dict) else None
            msg = (j.get("msg") if isinstance(j, dict) else None) or ""
            raise BgError(502, f"{code} {msg}")
        # 紧凑数组：1000 根的对象形式要大三倍。
        # turnover 带上：分时均价线 = 累计成交额 / 累计成交量，用 (高+低+收)/3 近似
        # 会有偏差，接口本来就给了就别近似。
        bars = []
        for x in ((j.get("data") or {}).get("list") or []):
            t = _bar_ms(x.get("timestamp"))
            if not math.isfinite(t):
                continue
            bars.append([_num_or_none(t), _plus(x.get("open")), _plus(x.get("high")), _plus(x.get("low")),
                         _plus(x.get("close")), _plus(x.get("volume")),
                         _SESS.get(x.get("tradeSession"), "?"), _plus(x.get("turnover"))])
        bars.sort(key=lambda b: b[0])
        _CCACHE[ck] = {"at": _now_ms(), "bars": bars}
        return {"sym": sym, "period": period, "cachedSec": 0, "bars": bars}
    except BgError:
        raise
    except Exception as e:  # noqa: BLE001
        raise BgError(502, str(e) or repr(e))


# ── 下单 ────────────────────────────────────────────────────
# 这是整个模块里唯一能动钱的地方，所以不开通用 POST 通道，只放写死的路径，
# 参数全部结构化校验后自己组装，不透传调用方的 body。
# 约束（改的时候不要放宽）：
#   · 只允许 LO 限价单，强制 timeInForce=Day —— 挂单最多活一天，就算这段代码
#     被改坏，能造成的最大损失也是一天内的限价单。
#   · 数量必须是正整数。实测 submittedQuantity 传 0.5 / 0.25 一律 101108
#     参数异常，Bitget Open API 不支持碎股（App 里可以）。
#   · 每笔金额有上限，超了直接拒绝。
#   · 用交易 key，且 passphrase 必须来自保险箱的 trade 槽（12 小时过期），
#     过期就要求重新输入，不接受前端传密码。
#   · 每一笔都写审计日志，成功失败都写。
# 另外：官方文档的 curl 示例把参数写在 query string 里，那样发一律 400172，
# 必须放 JSON body。签名 = ts + POST + 路径（不含 query）+ body。

NO_TRADE_PASS = "交易 passphrase 不在保险箱里或已过期（12 小时），去 /bg/setup 重新输入"


def max_order_usd():
    return _num_or_none(float(settings.bg_max_order_usd))


def audit(db: Session, rec: dict) -> None:
    try:
        db.add(Audit(kind=AUDIT_KIND, rec=rec))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def order_log(db: Session) -> dict:
    """最近 200 条，最新的在前。"""
    rows = db.scalars(select(Audit).where(Audit.kind == AUDIT_KIND)
                      .order_by(Audit.id.desc()).limit(200)).all()
    return {"maxOrderUsd": max_order_usd(),
            "log": [{"at": _iso(r.at), **(r.rec or {})} for r in rows]}


async def trade_post(db: Session, path: str, body: dict) -> dict:
    pass_ = vault_get(db, "trade")
    if not pass_:
        return {"err": NO_TRADE_PASS}
    key, secret = settings.bitget_key, settings.bitget_secret
    if not key or not secret:
        return {"err": "缺交易 key/secret"}
    b = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    ts = str(_now_ms())
    h = _headers(key, secret, ts, "POST", path, b)
    h["ACCESS-PASSPHRASE"] = pass_
    try:
        r = await get_client().post(HOST + path, headers=h, content=b.encode("utf-8"), timeout=20.0)
        return {"status": r.status_code, "j": r.json()}
    except Exception as e:  # noqa: BLE001
        return {"err": str(e) or repr(e)}


def _code_msg(j) -> str:
    if not isinstance(j, dict):
        return "None None"
    return f"{j.get('code')} {j.get('msg')}"


async def place_order(db: Session, b: dict) -> dict:
    b = b if isinstance(b, dict) else {}
    sym = str(b.get("sym") or "").strip().upper()
    side = "Sell" if b.get("side") == "sell" else ("Buy" if b.get("side") == "buy" else None)
    qty = _js_number(b.get("qty", _MISSING))
    price = _js_number(b.get("price", _MISSING))
    rth = b.get("outsideRth") if b.get("outsideRth") in ("RTHOnly", "AnyTime") else "RTHOnly"

    def bad(m: str):
        audit(db, {"ok": False, "why": m, "sym": sym, "side": side,
                   "qty": _num_or_none(qty), "price": _num_or_none(price)})
        return BgError(400, m)

    if not _sym_ok(sym):
        raise bad("代码不合法")
    if not side:
        raise bad("side 只能是 buy 或 sell")
    if not (math.isfinite(qty) and qty.is_integer()) or qty < 1 or qty > 10000:
        raise bad("数量必须是 1 以上的正整数（Bitget Open API 不支持碎股）")
    if not (price > 0) or price > 100000:
        raise bad("价格不合法")
    if b.get("confirm") is not True:
        raise bad("缺 confirm")
    usd = qty * price
    limit = float(settings.bg_max_order_usd)
    if usd > limit:
        raise bad(f"单笔 ${usd:.2f} 超过上限 ${_js_str(limit)}")

    body = {
        "symbol": sym + ".US", "orderType": "LO", "side": side,
        "submittedQuantity": str(int(qty)), "timeInForce": "Day",
        "submittedPrice": f"{price:.2f}", "outsideRth": rth,
        "remark": str(b.get("remark") or "lyra")[:60],
    }
    r = await trade_post(db, PREFIX + "trade/place-order", body)
    if r.get("err"):
        audit(db, {"ok": False, "why": r["err"], "body": body})
        raise BgError(502, r["err"])
    j = r.get("j")
    ok = isinstance(j, dict) and j.get("code") == "00000"
    audit(db, {"ok": ok, "body": body, "code": j.get("code") if isinstance(j, dict) else None,
               "msg": j.get("msg") if isinstance(j, dict) else None,
               "orderId": (j.get("data") or {}).get("orderId") if ok else None})
    if not ok:
        raise BgError(502, _code_msg(j))
    return {"ok": True, "orderId": (j.get("data") or {}).get("orderId"), "sym": sym, "side": side,
            "qty": _num_or_none(qty), "price": float(f"{price:.2f}"), "usd": float(f"{usd:.2f}")}


async def cancel_order(db: Session, b: dict) -> dict:
    b = b if isinstance(b, dict) else {}
    sym = str(b.get("sym") or "").strip().upper()
    oid = str(b.get("orderId") or "").strip()
    if not _sym_ok(sym):
        raise BgError(400, "代码不合法")
    if not OID_RE.match(oid):
        raise BgError(400, "orderId 不合法")
    r = await trade_post(db, PREFIX + "trade/cancel-order", {"symbol": sym + ".US", "orderId": oid})
    if r.get("err"):
        audit(db, {"ok": False, "act": "cancel", "why": r["err"], "sym": sym, "oid": oid})
        raise BgError(502, r["err"])
    j = r.get("j")
    ok = isinstance(j, dict) and j.get("code") == "00000"
    audit(db, {"ok": ok, "act": "cancel", "sym": sym, "oid": oid,
               "code": j.get("code") if isinstance(j, dict) else None,
               "msg": j.get("msg") if isinstance(j, dict) else None})
    if not ok:
        raise BgError(502, _code_msg(j))
    return {"ok": True, "sym": sym, "orderId": oid}
