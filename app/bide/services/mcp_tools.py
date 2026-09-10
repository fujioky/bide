"""MCP 工具表：blog/mcp.js 里 TOOLS 的移植。

与 JS 版最大的不同是取数方式：旧实现「内部自调」自己的 /api/*，这里直接调
services 里的函数（market_meta / bitget / zones）和 lists 里的读函数，不再走 HTTP。
私有数据按 OAuth 授权用户的本地 user_id 读取；不回退到管理员身份。

quant 那边仍然是 HTTP（x-api-key），路径与 JS 相同。日线在进程内缓存 30 分钟，
看板档位并发 4 —— 都是照搬 JS 的口径与理由（47 只并发回源会把 quant 打满）。

工具描述写给模型看，原样照搬 JS；search / fetch 去掉了文章部分（文章在另一个应用里）。
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import time
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..routers.lists import get_list, list_orders
from . import zones as Z

log = logging.getLogger("mcp.tools")

PROTOCOL = "2025-06-18"
SERVER_INFO = {"name": "bide", "title": "bide 行情与看板数据", "version": "1.0.0"}
INSTRUCTIONS = (
    "这是 bide 的只读数据接口：量化日线与期权（quant）、股市看板的关注/星标/订单/标签、实时报价。"
    "所有工具都是只读的，不会下单也不会改动任何服务。"
    "看板的档位排序（补票位/建仓区/强势区那套）用 dashboard_ranking 取，单只的区间段、金叉死叉与"
    "「将要启动」点位用 zone_detail——两个工具与页面共用同一份实现，结果必然一致，不要自己用 bars 重算。"
)


@dataclass
class Ctx:
    """一次 tools/call 的上下文：数据库会话 + 以谁的身份取数（授权用户的 user_id）。"""
    db: Session
    uid: int | None


NO_ACTOR = {"error": "需要用户授权"}


# ── 其它同事的 services：延迟导入，模块没到位时只影响相关工具，路由照常挂 ──

def meta_for(db: Session, syms: list[str]) -> dict:
    from . import market_meta
    return market_meta.meta_for(db, syms)


async def bg_quotes(db: Session, codes: list[str]) -> dict:
    from . import bitget
    return await bitget.quotes(db, codes)


async def bg_candles(db: Session, sym: str, period: str, count: int) -> dict:
    from . import bitget
    return await bitget.candles(db, sym, period, count)



# ── quant（HTTP）────────────────────────────────────────────

def qs(o: dict) -> str:
    p = []
    for k, v in o.items():
        if v is None or v == "":
            continue
        p.append(quote(str(k), safe="-_.!~*'()") + "=" + quote(str(v), safe="-_.!~*'()"))
    return ("?" + "&".join(p)) if p else ""


async def quant(method: str, path: str, body=None, timeout: float = 60):
    headers = {}
    if settings.quant_api_key:
        headers["x-api-key"] = settings.quant_api_key
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.request(method, settings.quant_base + path, json=body, headers=headers)
    try:
        data = r.json()
    except ValueError:
        data = r.text
    if r.status_code >= 400:
        return {"error": f"HTTP {r.status_code}", "detail": data}
    return data


# ── 看板档位（与 /dashboard 同一口径）──────────────────────

BARS_TTL = 30 * 60
_bars_cache: dict[str, tuple[float, list | None]] = {}


async def bars_of(sym: str):
    hit = _bars_cache.get(sym)
    if hit and time.time() - hit[0] < BARS_TTL:
        return hit[1]
    j = await quant("GET", "/api/public/bars" + qs({"symbol": sym, "years": 3}))
    rows = j.get("bars") if isinstance(j, dict) else None
    rows = rows if rows else None
    _bars_cache[sym] = (time.time(), rows)
    return rows


def reset_bars_cache() -> None:
    _bars_cache.clear()


def under_of(ctx: Ctx, syms: list[str]) -> dict[str, str | None]:
    """杠杆 ETF → 正股。市场元数据 names[sym].under。"""
    try:
        m = meta_for(ctx.db, syms)
    except Exception as e:  # noqa: BLE001  元数据缺了只是没法换正股，不该整批失败
        log.warning("market meta unavailable: %s", e)
        m = {}
    names = (m or {}).get("names") or {}
    out = {}
    for s in syms:
        rec = names.get(s)
        out[s] = rec.get("under") if isinstance(rec, dict) and rec.get("under") else None
    return out


async def row_for(sym: str, base: str | None) -> dict:
    own = await bars_of(sym)
    sig = (await bars_of(base)) if base else own
    if not own or not sig:
        return {"sym": sym, "error": "拿不到日线"}
    a = Z.analyze(sig)
    if base:
        lo = own[-1]
        pv = own[-2] if len(own) > 1 else None
        a["close"] = lo[4]
        a["chg"] = (lo[4] / pv[4] - 1) * 100 if pv else 0
    a["wait"] = Z.wait_of(a)
    rank = Z.rank_of(a)
    zone = a.get("zone")
    return {
        "sym": sym, "under": base or None, "date": a["date"], "rank": rank, "tier": Z.tier_of(rank),
        "close": a["close"], "chgPct": a["chg"], "rsi": a["rsi"], "dist200Pct": a["dist200"], "up200": a["up200"],
        "zone": ({"kind": zone["kind"], "name": Z.ZN[zone["kind"]][0],
                  "from": zone["from"], "to": zone["to"], "days": zone["days"]} if zone else None),
        "edge": a["edge"], "wait": a["wait"], "todayCross": a.get("todayCross") or [], "warm": a.get("warm") or None,
        "notes": [{"label": x["label"], "body": x["body"], "sub": x["sub"]} for x in Z.notes(a)],
    }


async def rows_for(ctx: Ctx, syms: list[str]) -> list[dict]:
    """并发 4：串行 47 只要 8 秒，客户端容易等超时；再高就没必要了。"""
    um = under_of(ctx, syms)
    sem = asyncio.Semaphore(4)

    async def one(s: str) -> dict:
        async with sem:
            try:
                return await row_for(s, um.get(s))
            except Exception as e:  # noqa: BLE001
                return {"sym": s, "error": str(e)}

    return list(await asyncio.gather(*(one(s) for s in syms)))


# ── 小工具 ───────────────────────────────────────────────────

def split_syms(s) -> list[str]:
    return [x.strip().upper() for x in str(s or "").split(",") if x.strip()]


def watch_syms(ctx: Ctx) -> list[str]:
    if ctx.uid is None:
        return []
    return [str(x).upper() for x in get_list(ctx.db, ctx.uid, "watch")]


def _clean(v):
    """JSON.stringify 把 Infinity/NaN 写成 null；json.dumps 会写出非法的 Infinity，这里先抹平。"""
    if isinstance(v, float) and not math.isfinite(v):
        return None
    if isinstance(v, dict):
        return {str(k): _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    return v


def to_text(out) -> str:
    if isinstance(out, str):
        return out
    return json.dumps(_clean(out), ensure_ascii=False, separators=(",", ":"))


# ── 工具实现 ─────────────────────────────────────────────────

async def t_watchlist(ctx: Ctx, _a: dict):
    if ctx.uid is None:
        return NO_ACTOR
    return {"symbols": get_list(ctx.db, ctx.uid, "watch")}


async def t_flags(ctx: Ctx, _a: dict):
    if ctx.uid is None:
        return NO_ACTOR
    return {"symbols": get_list(ctx.db, ctx.uid, "flag")}


async def t_orders(ctx: Ctx, _a: dict):
    if ctx.uid is None:
        return NO_ACTOR
    return {"orders": list_orders(ctx.db, ctx.uid)}


async def t_market_meta(ctx: Ctx, a: dict):
    syms = split_syms(a.get("symbols")) or watch_syms(ctx)
    return meta_for(ctx.db, syms)


async def t_quotes(ctx: Ctx, a: dict):
    return await bg_quotes(ctx.db, split_syms(a.get("symbols")))


async def t_intraday(ctx: Ctx, a: dict):
    return await bg_candles(ctx.db, str(a.get("symbol") or "").strip().upper(),
                            a.get("period") or "Min_2", int(a.get("count") or 500))



async def t_bars(_ctx: Ctx, a: dict):
    return await quant("GET", "/api/public/bars" + qs({"symbol": a.get("symbol"), "days": a.get("days") or 400}))


async def t_dashboard_ranking(ctx: Ctx, a: dict):
    lst = split_syms(a.get("symbols")) if a.get("symbols") else watch_syms(ctx)
    if not lst:
        return {"error": "没有标的"}
    rows = await rows_for(ctx, lst[:80])
    ok = sorted((r for r in rows if not r.get("error")), key=lambda r: r["rank"], reverse=True)
    min_rank = a.get("min_rank")
    out = [r for r in ok if r["rank"] >= min_rank] if min_rank else ok
    return {
        "asOf": ok[0]["date"] if ok else None,
        "cuts": {"88": "以下是买入侧，越靠前越该买", "60": "以下：价格已涨过当初的建仓区"},
        "count": len(out),
        "rows": out,
        "failed": [r for r in rows if r.get("error")],
    }


async def t_zone_detail(ctx: Ctx, a: dict):
    sym = str(a.get("symbol") or "").strip().upper()
    if not sym:
        return {"error": "要给 symbol"}
    um = under_of(ctx, [sym])
    r = await row_for(sym, um.get(sym))
    if r.get("error"):
        return r
    sig_rows = await bars_of(um.get(sym) or sym)
    return {**r, **Z.panel(sig_rows)}


async def t_coverage(_ctx: Ctx, _a: dict):
    return await quant("GET", "/api/coverage")


async def t_options(_ctx: Ctx, a: dict):
    # chain.json 必须带 snapshot_ts + source，两个都缺会 422、乱填会 500。
    # 所以先查快照清单取最新的那一份，调用方只要给个代码就行。
    underlying = a.get("underlying")
    snaps = await quant("GET", "/api/options/snapshots" + qs({"underlying": underlying}))
    lst = snaps.get("snapshots") if isinstance(snaps, dict) else None
    s0 = lst[0] if isinstance(lst, list) and lst else None
    if not s0:
        return {"error": "这个标的还没有期权链快照", "underlying": underlying}
    return await quant("GET", "/api/options/chain.json" + qs({
        "underlying": underlying, "snapshot_ts": s0.get("snapshot_ts"), "source": s0.get("source"),
        "expiry": a.get("expiry")}))


async def t_fundamentals(_ctx: Ctx, a: dict):
    return await quant("GET", "/api/fundamentals.json" + qs({"symbol": a.get("symbol")}))



async def t_search(ctx: Ctx, a: dict):
    q = str(a.get("query") or "").strip().upper()
    hit = [s for s in watch_syms(ctx) if q in s]
    return {
        "ids": ["sym:" + s for s in hit],
        "results": [{"id": "sym:" + s, "title": s, "url": f"{settings.base_url}/dashboard#{s}"} for s in hit],
    }


async def t_fetch(ctx: Ctx, a: dict):
    s = str(a.get("id") or "")
    if not s.startswith("sym:"):
        return {"error": "id 只支持 sym: 前缀"}
    sym = s[4:].strip().upper()

    async def _q():
        return await bg_quotes(ctx.db, [sym])

    async def _b():
        return await quant("GET", "/api/public/bars" + qs({"symbol": sym, "days": 400}))

    meta = meta_for(ctx.db, [sym])
    quote_, bars = await asyncio.gather(_q(), _b())
    return {"id": s, "title": sym, "meta": meta, "quote": quote_, "bars": bars}


# ── 工具表 ───────────────────────────────────────────────────
#    描述写给模型看，写清楚「这个数是什么口径」比写清楚参数更重要。

TOOLS: list[dict] = [
    {
        "name": "watchlist",
        "description": "我的关注列表（标的代码数组）。杠杆 ETF 与正股都在里面。",
        "schema": {"type": "object", "properties": {}},
        "run": t_watchlist,
    },
    {
        "name": "flags",
        "description": "星标：打算买入的标的（区别于关注 = 只是在看）。",
        "schema": {"type": "object", "properties": {}},
        "run": t_flags,
    },
    {
        "name": "orders",
        "description": "手工录入的全部订单流水（买卖、日期、股数、价格）。持仓与均价由这些流水算出。",
        "schema": {"type": "object", "properties": {}},
        "run": t_orders,
    },
    {
        "name": "market_meta",
        "description": "标的元数据：中文名、赛道标签、财报日、分析师评级分布、杠杆 ETF 到正股的映射。",
        "schema": {
            "type": "object",
            "properties": {"symbols": {"type": "string", "description": "逗号分隔，如 NVDA,OKLO。留空则取关注列表。"}},
        },
        "run": t_market_meta,
    },
    {
        "name": "quotes",
        "description": "实时报价（Bitget Stock+，延迟约 15 分钟）。含盘前/盘中/盘后各时段的最新价与涨跌幅。",
        "schema": {
            "type": "object",
            "properties": {"symbols": {"type": "string", "description": "逗号分隔，如 NVDA,AAPL"}},
            "required": ["symbols"],
        },
        "run": t_quotes,
    },
    {
        "name": "intraday",
        "description": "日内 K 线（Bitget，含盘前/盘中/盘后分段，夜盘拿不到）。period 可选 Min_1/Min_2/Min_5/Min_15/Min_30/Min_60。",
        "schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "period": {"type": "string", "default": "Min_2"},
                "count": {"type": "integer", "description": "最多 1000", "default": 500},
            },
            "required": ["symbol"],
        },
        "run": t_intraday,
    },

    {
        "name": "bars",
        "description": "日线 OHLCV（quant 的 DuckDB 缓存，源为 yfinance，含股息复权）。做均线、RSI、MACD、区间判定用的就是这一份。",
        "schema": {
            "type": "object",
            "properties": {"symbol": {"type": "string"}, "days": {"type": "integer", "default": 400}},
            "required": ["symbol"],
        },
        "run": t_bars,
    },
    {
        "name": "dashboard_ranking",
        "description":
            "看板 /dashboard 的完整档位排序，与页面上看到的逐字段一致（同一份 zones.js 实现）。"
            "按 rank 从高到低返回：100 强势区终止·该清仓 > 92 强势区进行中 > 88 强势区第一天 > 84 补票位·超卖区 > "
            "83 超卖区第一天 > 82 仍在超卖区价位 > 81 超卖区进行中 > 80 补票位·建仓区 > 75 建仓区第一天 > "
            "72 建仓区进行中 > 66 仍在建仓区价位 > 60 区间外金叉 > 50 高于建仓区 > 10 其它 > 5 死叉。"
            "88 以下是买入侧、越靠前越该买；60 以下是买入侧里最差的一档。"
            "每只带当前区间（zone：a 强势区 / g 超卖区 / b 建仓区）、等待状态（wait）、当天金叉死叉（todayCross）、"
            "将要启动（warm，只报最近 30 天内最近一次）。杠杆 ETF 的区间与交叉按正股算、价格用它自己的。"
            "口径依据是实测得来的，别自己改档位含义。",
        "schema": {
            "type": "object",
            "properties": {
                "symbols": {"type": "string", "description": "逗号分隔；留空则用关注列表全部"},
                "min_rank": {"type": "integer", "description": "只回 rank ≥ 这个值的，比如 80 只看买入侧靠前的"},
            },
        },
        "run": t_dashboard_ranking,
    },
    {
        "name": "zone_detail",
        "description":
            "单只标的的区间与信号明细，范围与图表面板完全一致——三年日线上的全部内容，不截断："
            "① 全部区间段（超卖区/建仓区/强势区），每段带起止日期、天数、段内最低最高价与中值、振幅；"
            "买入区另给等权均价 avg 与按金叉死叉加权的均价 wavg（金叉那天权重更高），"
            "强势区另给首末涨跌 chgPct、卖出价 sell 与相对此前累计买入成本的 gainPct（强势区视为清仓，"
            "所以 cost/gain 依赖区间先后顺序）。② 三年内全部金叉死叉（MA5×MA60、MA60×MA200、MACD DIF×DEA "
            "三对，就是图上画出来的那些点；面板底部的表只列最近 14 次，这里给全部）。"
            "③ 三年内全部「将要启动」点位（KDJ 三线聚在 40~60 中轴带且 J>K>D，同时 DIF>DEA>0——"
            "它不是买点，只说明动能快起来了）。另附这只当前的档位与等待状态。"
            "杠杆 ETF 自动换成正股来算，返回里的 under 说明换成了谁。",
        "schema": {
            "type": "object",
            "properties": {"symbol": {"type": "string"}},
            "required": ["symbol"],
        },
        "run": t_zone_detail,
    },
    {
        "name": "coverage",
        "description": "quant 缓存了哪些标的、各自的时间范围与根数。",
        "schema": {"type": "object", "properties": {}},
        "run": t_coverage,
    },
    {
        "name": "options",
        "description": "期权链快照（源 CBOE，前一交易日收盘口径，带 bid/ask、IV、未平仓量、希腊字母）。",
        "schema": {
            "type": "object",
            "properties": {
                "underlying": {"type": "string"},
                "expiry": {"type": "string", "description": "YYYY-MM-DD，留空取该快照的全部到期日"},
            },
            "required": ["underlying"],
        },
        "run": t_options,
    },
    {
        "name": "fundamentals",
        "description": "财报与基本面（yfinance，每周日刷新）。",
        "schema": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]},
        "run": t_fundamentals,
    },

    # ── 下面两个是 ChatGPT 的硬性要求 ──
    #    没开 Developer Mode 时它只认 search / fetch 这两个名字，
    #    缺了会直接拒绝整个连接器。开了也无害。
    #    文章已经搬去另一个应用，这里只搜关注列表里的代码。
    {
        "name": "search",
        "description": "按关键词找标的，返回 id 列表，再用 fetch 取详情。（也是 ChatGPT 连接器的必需工具）",
        "schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        "run": t_search,
    },
    {
        "name": "fetch",
        "description": "按 search 给的 id 取完整内容。id 形如 sym:NVDA。（也是 ChatGPT 连接器的必需工具）",
        "schema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
        "run": t_fetch,
    },
]

TOOL_LIST = [{"name": t["name"], "description": t["description"], "inputSchema": t["schema"],
              "annotations": {"readOnlyHint": True, "destructiveHint": False},
              "securitySchemes": [{"type": "oauth2", "scopes": ["mcp:read"]}]} for t in TOOLS]
_BY_NAME = {t["name"]: t for t in TOOLS}


def find_tool(name) -> dict | None:
    return _BY_NAME.get(name)
