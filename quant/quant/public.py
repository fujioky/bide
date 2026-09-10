"""公开只读行情接口（给博客里的行情组件用，无鉴权）。

只回 3 年日线，仅此一个端点开放 CORS。缓存里没有的标的现拉 yfinance 并入库。
"""
import re
import time
from datetime import datetime, timezone, date, timedelta

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from .db import SRC_RANK, db_rows
from .tasks import task_backfill_bars

router = APIRouter()

# 允许指数代码（^IXIC、^GSPC、^VIX 这类）
_PUB_SYM = re.compile(r"^\^?[A-Z][A-Z0-9.\-]{0,9}$")
# 常见指数：允许不带 ^ 直接搜
_INDEX_ALIAS = {"IXIC": "^IXIC", "GSPC": "^GSPC", "SPX": "^GSPC", "DJI": "^DJI",
                "DJIA": "^DJI", "VIX": "^VIX", "NDX": "^NDX", "RUT": "^RUT",
                "SOX": "^SOX", "TNX": "^TNX", "HSI": "^HSI", "N225": "^N225"}

_HDR = {"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=1800"}


def norm_sym(s: str) -> str:
    s = (s or "").strip().upper()
    return _INDEX_ALIAS.get(s, s)


# 限流：这个端点只给自家博客/看板用，看板是串行取数（一次一个请求），
# 所以按秒卡就够——目的是防止某个页面死循环把服务和上游 yfinance 打崩，
# 而不是限制正常使用。原来是 30 次/分钟，看板关注列表超过 30 只时必然撞上。
_pub_hits: dict = {}


def _pub_rate_ok(ip: str, limit: int = 10, window: int = 1) -> bool:
    now = time.time()
    arr = [t for t in _pub_hits.get(ip, []) if now - t < window]
    arr.append(now)
    _pub_hits[ip] = arr
    if len(_pub_hits) > 500:
        for k in [k for k, v in _pub_hits.items() if not v or now - v[-1] > 600]:
            _pub_hits.pop(k, None)
    return len(arr) <= limit


# sym -> (上次现拉的时间戳, 那次拉之前的根数)，见 _pub_should_pull
_pub_pull_at: dict = {}


def _pub_should_pull(sym: str, rows: list, start: str) -> bool:
    """这次请求要不要现拉一次 yfinance。

    原来的判据是 len(rows) < 200。像 LYTE（Roundhill 光电 ETF，2026-08-06 上市、
    全部历史只有 19 根）这种天生够不到 200 根的标的，等于每来一次请求就打一次
    上游，纯属白打。改成看新鲜度和覆盖范围：
      * 一根都没有            → 拉
      * 最新一根落后 4 天以上  → 拉（4 天够盖住周末加一天假期）
      * 历史比请求窗口短 10 天以上 → 拉，但同一个标的一天最多试一次；
        如果上一次拉完根数根本没变，说明上游就这么多，冷却拉长到 7 天。
        （10 天的余量是因为 start 按 372 天/年 粗算，正常标的的第一根
          本来就会比 start 晚几天，不留余量的话每只每天都会白拉一次）
    """
    if not rows:
        return True
    now = time.time()
    last = str(rows[-1]["ts"])[:10]
    try:
        behind = (datetime.now(timezone.utc).date() - date.fromisoformat(last)).days
    except Exception:
        return True
    if behind > 4:
        return True
    first = str(rows[0]["ts"])[:10]
    try:
        short_by = (date.fromisoformat(first) - date.fromisoformat(start)).days
    except Exception:
        return False
    if short_by <= 10:
        return False          # start 是按 372 天/年 粗算的，差几天是周末假日，不算缺
    at, n = _pub_pull_at.get(sym, (0.0, -1))
    # 上一次拉完根数没变 → 上游就这么多（LYTE 这种新股），冷却拉长到 7 天
    cool = 7 * 86400 if n == len(rows) else 86400
    if now - at > cool:
        _pub_pull_at[sym] = (now, len(rows))
        return True
    return False


@router.get("/api/public/bars")
def api_public_bars(symbol: str, request: Request, years: int = 3):
    sym = norm_sym(symbol)
    hdr = dict(_HDR)
    if not _PUB_SYM.match(sym):
        return JSONResponse({"error": "bad symbol"}, status_code=400, headers=hdr)
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or "?"
    if not _pub_rate_ok(ip):
        return JSONResponse({"error": "rate limited"}, status_code=429, headers=hdr)

    years = max(1, min(int(years or 3), 10))
    start = (datetime.now(timezone.utc).date() - timedelta(days=int(years * 372))).isoformat()

    def pull():
        sql = f"""SELECT ts,open,high,low,close,volume FROM (
                    SELECT *, row_number() OVER (PARTITION BY ts ORDER BY {SRC_RANK}) rn
                    FROM bars WHERE symbol=? AND tf='1d' AND ts >= ?) WHERE rn=1 ORDER BY ts"""
        return db_rows(sql, [sym, start])

    rows = pull()
    fetched = False
    if _pub_should_pull(sym, rows, start):
        try:
            task_backfill_bars(sym, period=f"{years}y")
            rows = pull()
            fetched = True
        except Exception as e:
            if not rows:
                return JSONResponse({"error": "no data: %s" % e}, status_code=404, headers=hdr)
    if not rows:
        return JSONResponse({"error": "no data"}, status_code=404, headers=hdr)
    out = [[r["ts"].isoformat()[:10] if hasattr(r["ts"], "isoformat") else str(r["ts"])[:10],
            round(float(r["open"]), 4), round(float(r["high"]), 4),
            round(float(r["low"]), 4), round(float(r["close"]), 4),
            int(r["volume"] or 0)] for r in rows]
    return JSONResponse({"symbol": sym, "fetched": fetched, "bars": out}, headers=hdr)


@router.options("/api/public/bars")
def api_public_bars_opt():
    return Response(status_code=204, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400"})
