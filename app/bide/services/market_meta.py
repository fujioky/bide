"""市场元数据：中文名、杠杆 ETF 对应正股、分析师一致预期
   ────────────────────────────────────────────────────────────
   数据由 grok-agent（跑 grok CLI，能联网）去查，本模块只负责排队、落盘、推给页面。

   三条原则：
   ① 全异步。/api/market/meta 立刻回已经存下来的部分，缺的丢进队列，页面照常渲染。
   ② 查到之后主动推。页面在有 pending 时开一条 SSE（/api/market/stream），
      队列每完成一批就把新数据推过去，页面原地把代码换成中文名、把分析师条画出来。
   ③ 分析师数据每天刷一次（UTC 22:10，排在 quant 补完日线之后）。
      新加的标的是例外——第一次见到就立刻排队，不然要等到第二天才有数。

   blog/market-meta.js 的 Python 移植：四类记录（names/analyst/tags/earnings）存
   market_meta 表，{lastDaily} 存 kv 表的 market.state；内存里各留一份缓存，写入时同时落表。
   队列循环是一个 asyncio task，agent 调用走 httpx.AsyncClient。
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..models import KV, MarketMeta
from ..routers.lists import all_watched

log = logging.getLogger("market")

_SYM = re.compile(r"^\^?[A-Z][A-Z0-9.\-]{0,9}$")
STATE_KEY = "market.state"
KINDS = ("names", "analyst", "tags", "earnings")


def ok_sym(s) -> bool:
    return bool(_SYM.match(str(s or "")))


# 指数没有分析师覆盖；ETF 也没有（杠杆 ETF 会被映射到正股再查）
INDEX = {"IXIC", "SPX", "DJI", "NDX", "VIX", "RUT"}

# 主题标签的取值范围。杠杆 ETF 不打标签（看它正股的），指数也不打（前端直接显示「指数」）。
TAG_SET = ["AI算力", "存储", "光通信", "数据中心电力", "能源电力", "核能", "太空卫星",
           "量子计算", "电信设备", "金融科技", "工业材料", "宽基指数"]


def now_ms() -> int:
    return int(time.time() * 1000)


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def num(v):
    return v if _is_num(v) else None


def int_(v):
    # JS Math.round：.5 向正无穷取整
    return int(math.floor(v + 0.5)) if _is_num(v) else None


def str_(v) -> str:
    return v[:40] if isinstance(v, str) else ""


def _sym_of(it) -> str:
    return str((it or {}).get("sym") or "").upper() if isinstance(it, dict) else ""


class MarketMetaService:
    def __init__(self) -> None:
        self.NAMES: dict[str, dict] = {}   # SYM -> {zh,en,kind,under,lev,at}
        self.ANA: dict[str, dict] = {}     # SYM -> {n,buy,hold,sell,low,mean,high,src,asof,at} 或 {none:1,at}
        self.ST: dict = {}                 # {lastDaily:'YYYY-MM-DD'}
        self.TAGS: dict[str, dict] = {}    # SYM -> {tags:[...],note,at}   标签只给正股和普通 ETF 打
        self.EARN: dict[str, dict] = {}    # SYM -> {date,when,fy,fq,confirmed,src,asof,at} 或 {none:1,at}   下一次财报披露
        self.loaded = False

        # ── 队列：名字优先（快、便宜），分析师排后面 ──（dict 当有序集合用）
        self.qn: dict[str, None] = {}
        self.qa: dict[str, None] = {}
        self.qt: dict[str, None] = {}
        self.qe: dict[str, None] = {}
        # 查过一次就先别再查：有些标的（未上市、太冷门）grok 那边根本给不出结果，
        # 不设这道闸的话每次有人打开页面都会重新排一遍队。
        self.TRIED: dict[str, int] = {}
        self.running = False
        self.last_err = ""

        # ── 推送：每个 SSE 客户端一个 asyncio.Queue ──
        self.clients: set[asyncio.Queue] = set()

        self.http: httpx.AsyncClient | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_task: asyncio.Task | None = None
        self._tick_task: asyncio.Task | None = None

    @property
    def ready(self) -> bool:
        return bool(settings.agent_url and settings.agent_secret)

    # ── 落表 / 加载 ─────────────────────────────────────────

    def load(self, db: Session) -> None:
        """启动时从表把四类记录和状态读进内存。"""
        for row in db.scalars(select(MarketMeta)):
            store = self._store(row.kind)
            if store is not None and isinstance(row.data, dict):
                store[row.sym] = dict(row.data)
        kv = db.get(KV, STATE_KEY)
        self.ST = dict(kv.value or {}) if kv else {}
        self.loaded = True

    def ensure_loaded(self, db: Session | None = None) -> None:
        if self.loaded:
            return
        if db is not None:
            self.load(db)
            return
        s = SessionLocal()
        try:
            self.load(s)
        finally:
            s.close()

    def _store(self, kind: str) -> dict | None:
        return {"names": self.NAMES, "analyst": self.ANA, "tags": self.TAGS, "earnings": self.EARN}.get(kind)

    @staticmethod
    def _put_rows(db: Session, kind: str, recs: dict[str, dict]) -> None:
        for sym, rec in recs.items():
            row = db.get(MarketMeta, (kind, sym))
            if row:
                row.data = rec
            else:
                db.add(MarketMeta(kind=kind, sym=sym, data=rec))
        db.commit()

    def _dump(self, kind: str, recs: dict[str, dict], db: Session | None = None) -> None:
        """内存已经改好，这里只负责落表。异步循环里每次开新 Session、用完关。"""
        if db is not None:
            self._put_rows(db, kind, recs)
            return
        s = SessionLocal()
        try:
            self._put_rows(s, kind, recs)
        finally:
            s.close()

    def _dump_state(self, db: Session | None = None) -> None:
        own = db is None
        s = db or SessionLocal()
        try:
            kv = s.get(KV, STATE_KEY)
            if kv:
                kv.value = dict(self.ST)
            else:
                s.add(KV(key=STATE_KEY, value=dict(self.ST)))
            s.commit()
        finally:
            if own:
                s.close()

    # ── 分析师数据看哪只：杠杆 ETF 看正股 ──
    def target(self, s: str) -> str:
        m = self.NAMES.get(s)
        return m["under"] if m and m.get("under") else s

    # 指数与 ETF 没有分析师覆盖，别去白查一遍
    def coverable(self, s: str) -> bool:
        if s.startswith("^") or s in INDEX:
            return False
        m = self.NAMES.get(s)
        if m and m.get("kind") in ("index", "etf"):
            return False
        return True

    @staticmethod
    def fresh(r, hours: float) -> bool:
        return bool(r and r.get("at") and (now_ms() - r["at"]) < hours * 3600e3)

    # 打标签的范围：正股与普通 ETF；杠杆 ETF 和指数不打
    def taggable(self, s: str) -> bool:
        if s.startswith("^") or s in INDEX:
            return False
        m = self.NAMES.get(s)
        if not m:
            return True
        if m.get("under"):                  # 杠杆/反向 ETF
            return False
        return m.get("kind") != "index"

    # 查财报的范围：只有正股有财报
    def has_earnings(self, s: str) -> bool:
        if s.startswith("^") or s in INDEX:
            return False
        m = self.NAMES.get(s)
        if not m:
            return True
        return m.get("kind") == "stock" and not m.get("under")

    # ── 推送 ──
    def push(self, obj: dict) -> None:
        line = "data: " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n\n"
        for q in list(self.clients):
            try:
                q.put_nowait(line)
            except Exception:  # noqa: BLE001  队列满 / 客户端已走
                pass

    # ── 队列 ──
    def want(self, q: dict, kind: str, s: str) -> bool:
        k = kind + ":" + s
        t = self.TRIED.get(k)
        if t and now_ms() - t < 6 * 3600e3:
            return False
        self.TRIED[k] = now_ms()
        q[s] = None
        return True

    def _has_work(self) -> bool:
        return bool(self.qn or self.qt or self.qe or self.qa)

    def kick(self) -> None:
        """30ms 后起一轮循环（同一时刻的多次请求合成一批）。可从任意线程调。"""
        if self.running or not self.ready:
            return
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return
        loop.call_soon_threadsafe(loop.call_later, 0.03, self._start_loop)

    def _start_loop(self) -> None:
        if self.running or (self._loop_task and not self._loop_task.done()):
            return
        self._loop_task = asyncio.get_running_loop().create_task(self.loop())

    async def loop(self) -> None:
        if self.running:
            return
        self.running = True
        try:
            while self._has_work():
                if self.qn:
                    b = self._take(self.qn, 8)
                    await self.job_names(b)
                elif self.qt:
                    b = self._take(self.qt, 10)
                    await self.job_tags(b)
                elif self.qe:
                    b = self._take(self.qe, 6)
                    await self.job_earnings(b)
                else:
                    b = self._take(self.qa, 5)
                    await self.job_analyst(b)
        except asyncio.CancelledError:
            self.running = False
            raise
        except Exception as e:  # noqa: BLE001
            self.last_err = str(e)
            log.exception("market queue")
        self.running = False

    async def drain(self) -> None:
        """跑到队列空为止（测试 / 手动用）：已经在跑就等它跑完。"""
        if self._loop_task and not self._loop_task.done():
            await self._loop_task
        else:
            await self.loop()

    @staticmethod
    def _take(q: dict, n: int) -> list[str]:
        b = list(q)[:n]
        for s in b:
            q.pop(s, None)
        return b

    async def ask_agent(self, prompt: str, max_turns: int):
        if not self.ready:
            return None
        if self.http is None:
            self.http = httpx.AsyncClient(timeout=420)
        r = await self.http.post(settings.agent_url + "/json",
                                 headers={"x-agent-secret": settings.agent_secret},
                                 json={"prompt": prompt, "maxTurns": max_turns})
        if not (200 <= r.status_code < 300):
            self.last_err = "agent " + str(r.status_code)
            return None
        j = r.json()
        if not j or not isinstance(j, dict) or not j.get("ok"):
            self.last_err = (isinstance(j, dict) and j.get("err")) or "agent 没给出 JSON"
            return None
        return j.get("json")

    # ── 四个 job：prompt 原文照抄 market-meta.js ──

    async def job_names(self, syms: list[str]) -> None:
        prompt = "查这些美股代码（可能是个股、ETF、指数或杠杆/反向 ETF）：" + ", ".join(syms) + '''
每个代码给出：
- zh：只在存在「官方或公认的中文名」时才填中文——公司自己在中文场合用的名字，或中文财经媒体长期通用的译名（例如 NVDA=英伟达、AVGO=博通、MU=美光、NOK=诺基亚）。
  没有这种名字的，一律原样填英文名，不要音译、不要意译、不要自己造一个中文名。
  （反例：Lightbridge 不要写成「光桥」，Oklo 不要写成「奥克洛」，X-Energy 不要写成「X能源」——这三个都应该直接填英文。）
  再举几个应当保留英文的：Constellation Energy、Rocket Lab、Lumentum、Coherent、Materion、Graham、Planet Labs、BlackSky。
  普通 ETF 和指数可以用中文说明它跟踪什么（例如「纳指100 ETF」「费城半导体 ETF」）。不超过 14 个字。
  杠杆/反向 ETF 的 zh 不用管，服务端会统一写成「正股代码 + 倍数说明 + ETF」。
- en：英文全名
- kind：stock 或 etf 或 index
- under：如果它是杠杆或反向 ETF，填它跟踪的那只**可交易标的**的代码——比如 TQQQ 填 QQQ（不要填 NDX 这种指数代码）、SOXL 填 SOXX、LNOK 填 NOK；不是杠杆 ETF 就填空字符串
- lev：如果是杠杆或反向 ETF，填「2倍做多」「3倍做空」「反向」这类中文说明；否则填空字符串
查不到的代码，zh 填代码本身、kind 填 stock，其余留空。不要编造公司。
全部查完后只输出一行 JSON 数组，不要代码块标记、不要任何其它文字：
[{"sym":"","zh":"","en":"","kind":"","under":"","lev":""}]'''

        arr = await self.ask_agent(prompt, 24)
        if not isinstance(arr, list):
            log.warning("names job 无结果 syms=%s lastErr=%s", syms, self.last_err)
            return
        out: dict[str, dict] = {}
        for it in arr:
            s = _sym_of(it)
            if not ok_sym(s) or s not in syms:
                continue
            under = str(it.get("under") or "").upper()
            rec = {
                "zh": str_(it.get("zh")) or s,
                "en": str_(it.get("en")),
                "kind": it.get("kind") if it.get("kind") in ("stock", "etf", "index") else "stock",
                "under": under if ok_sym(under) and under != s else "",
                "lev": str_(it.get("lev")),
                "at": now_ms(),
            }
            # 杠杆 ETF 的名字统一由服务端拼，免得每只写法都不一样
            if rec["under"] and rec["lev"]:
                rec["zh"] = rec["under"] + " " + rec["lev"] + "ETF"
            self.NAMES[s] = rec
            out[s] = rec
            # 查出来是杠杆 ETF：分析师数据要去查它的正股
            if rec["under"]:
                if rec["under"] not in self.NAMES:
                    self.want(self.qn, "n", rec["under"])
                if rec["under"] not in self.ANA and self.coverable(rec["under"]):
                    self.want(self.qa, "a", rec["under"])
            elif s not in self.ANA and self.coverable(s):
                self.want(self.qa, "a", s)
        if out:
            self._dump("names", out)
            self.push({"names": out})

    async def job_analyst(self, syms: list[str]) -> None:
        prompt = "联网查这些美股当前的华尔街分析师一致预期：" + ", ".join(syms) + '''
每只给出：分析师总家数 n、买入类家数 buy、持有 hold、卖出类家数 sell，
未来 12 个月目标价最低 low / 平均 mean / 最高 high（美元），来源站点 src，统计日期 asof（YYYY-MM-DD）。
同一只标的的评级家数和目标价尽量取自同一个来源，保证 buy+hold+sell 等于 n。
没有分析师覆盖的（比如 ETF、指数、太小的公司）把 n 填 0、目标价填 null。
任何查不到的字段填 null，绝对不要编造数字。
全部查完后只输出一行 JSON 数组，不要代码块标记、不要任何其它文字：
[{"sym":"","n":0,"buy":0,"hold":0,"sell":0,"low":0,"mean":0,"high":0,"src":"","asof":""}]'''

        arr = await self.ask_agent(prompt, 40)
        if not isinstance(arr, list):
            log.warning("analyst job 无结果 syms=%s lastErr=%s", syms, self.last_err)
            return
        out: dict[str, dict] = {}
        for it in arr:
            s = _sym_of(it)
            if not ok_sym(s) or s not in syms:
                continue
            n = int_(it.get("n"))
            rec = {
                "n": n, "buy": int_(it.get("buy")) or 0, "hold": int_(it.get("hold")) or 0, "sell": int_(it.get("sell")) or 0,
                "low": num(it.get("low")), "mean": num(it.get("mean")), "high": num(it.get("high")),
                "src": str_(it.get("src")), "asof": str_(it.get("asof")), "at": now_ms(),
            } if n else {"none": 1, "at": now_ms()}
            self.ANA[s] = rec
            out[s] = rec
        if out:
            self._dump("analyst", out)
            self.push({"analyst": out})

    async def job_tags(self, syms: list[str]) -> None:
        prompt = "给这些美股打投资主题标签：" + ", ".join(syms) + '''
标签只能从这个集合里选，一只可以选多个（按相关度排，最相关的放第一个），至少一个：
''' + "、".join(TAG_SET) + '''
判断依据是它主要的收入来源和产业链位置，不是名字。举例：存储芯片公司同时属于「AI算力」和「存储」；
核电运营商同时属于「数据中心电力」和「核能」；宽基或行业 ETF 用「宽基指数」。
如果集合里确实没有合适的，tags 填空数组，另外在 note 里用四个字以内说它是干什么的。
全部判完后只输出一行 JSON 数组，不要代码块标记、不要其它文字：
[{"sym":"","tags":[""],"note":""}]'''
        arr = await self.ask_agent(prompt, 30)
        if not isinstance(arr, list):
            log.warning("tags job 无结果 syms=%s lastErr=%s", syms, self.last_err)
            return
        out: dict[str, dict] = {}
        for it in arr:
            s = _sym_of(it)
            if not ok_sym(s) or s not in syms:
                continue
            raw = it.get("tags") if isinstance(it.get("tags"), list) else []
            tags = [t for t in (str(x).strip() for x in raw) if t in TAG_SET][:5]
            # 过滤后为空 = agent 给的主题不在 TAG_SET 里（它的判断写在 note 里）。
            # 这种记录要打上 nofit，否则 `!TAGS[s]` 为假、以后永远不会重查——
            # 往 TAG_SET 里加了新标签也补不上。
            rec = {"tags": tags, "note": str_(it.get("note")), "at": now_ms(), "auto": 1}
            if not tags:
                rec["nofit"] = 1
            self.TAGS[s] = rec
            out[s] = rec
        if out:
            self._dump("tags", out)
            self.push({"tags": out})

    async def job_earnings(self, syms: list[str]) -> None:
        prompt = "联网查这些美股「下一次」财报披露的日期：" + ", ".join(syms) + '''
每只给出：
- date：披露日期 YYYY-MM-DD（美东）。已经公布过、下一次日期还没定的填 null
- when：盘前 或 盘后 或 未知
- fy：这次披露对应的财年（很多公司财年和自然年不一样，例如 Planet Labs 财年 1 月底结束，2026 年 9 月披露的是 2027 财年）
- fq：第几个财季，1 到 4
- confirmed：公司已正式公告该日期填 true，只是市场预估填 false
- src：来源站点，asof：你查到这份信息的日期 YYYY-MM-DD
查不到的字段填 null，绝对不要编造日期。
全部查完后只输出一行 JSON 数组，不要代码块标记、不要其它文字：
[{"sym":"","date":"","when":"","fy":0,"fq":0,"confirmed":false,"src":"","asof":""}]'''
        arr = await self.ask_agent(prompt, 40)
        if not isinstance(arr, list):
            log.warning("earnings job 无结果 syms=%s lastErr=%s", syms, self.last_err)
            return
        out: dict[str, dict] = {}
        for it in arr:
            s = _sym_of(it)
            if not ok_sym(s) or s not in syms:
                continue
            d0 = str(it.get("date") or "")
            d = d0 if re.match(r"^\d{4}-\d{2}-\d{2}$", d0) else None
            rec = {
                "date": d, "when": it.get("when") if it.get("when") in ("盘前", "盘后") else "",
                "fy": int_(it.get("fy")), "fq": int_(it.get("fq")), "confirmed": it.get("confirmed") is True,
                "src": str_(it.get("src")), "asof": str_(it.get("asof")), "at": now_ms(),
            } if d else {"none": 1, "at": now_ms()}
            self.EARN[s] = rec
            out[s] = rec
        if out:
            self._dump("earnings", out)
            self.push({"earnings": out})

    # ── 每天一次的统一刷新：关注列表里的全部标的 ──
    def refresh_all(self, why: str, db: Session | None = None) -> dict:
        own = db is None
        s = db or SessionLocal()
        try:
            self.ensure_loaded(s)
            lst = all_watched(s)
        finally:
            if own:
                s.close()
        n = a = tg = er = 0
        for sym in lst:
            if sym not in self.NAMES and self.want(self.qn, "n", sym):
                n += 1
            # 没标签的、以及上次没匹配上 TAG_SET 的（nofit），都重查一遍。
            # 手工打过的（没有 auto 标记）绝不重查，否则会被自动结果覆盖。
            tg_rec = self.TAGS.get(sym)
            if self.taggable(sym) and (not tg_rec or (tg_rec.get("auto") and tg_rec.get("nofit"))):
                if tg_rec:
                    self.TRIED.pop("t:" + sym, None)
                if self.want(self.qt, "t", sym):
                    tg += 1
            # 财报日会变（披露完要换下一季），一天刷一次
            if self.has_earnings(sym) and not self.fresh(self.EARN.get(sym), 20):
                self.TRIED.pop("e:" + sym, None)
                if self.want(self.qe, "e", sym):
                    er += 1
            t = self.target(sym)
            if not self.coverable(t):
                continue
            if self.fresh(self.ANA.get(t), 12):      # 半天内刚查过就不重复
                continue
            self.TRIED.pop("a:" + t, None)           # 每日刷新是有意重查，闸门放行
            if self.want(self.qa, "a", t):
                a += 1
        log.info("market refresh why=%s watched=%d names=%d tags=%d earnings=%d analyst=%d",
                 why, len(lst), n, tg, er, a)
        self.kick()
        return {"watched": len(lst), "names": n, "tags": tg, "earnings": er, "analyst": a}

    # UTC 22:10 之后跑当天那次（quant 的日线补数在 21:15）
    def tick(self, now: datetime | None = None) -> bool:
        if not self.ready:
            return False
        now = now or datetime.now(timezone.utc)
        day = now.strftime("%Y-%m-%d")
        if self.ST.get("lastDaily") == day:
            return False
        if now.hour < 22:
            return False
        self.ST["lastDaily"] = day
        self._dump_state()
        self.refresh_all("daily")
        return True

    def boot(self) -> bool:
        """冷启动：从没跑过（首次上线）就先补一轮，之后交给定时。"""
        if not self.ready or self.ST.get("lastDaily"):
            return False
        self.ST["lastDaily"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self._dump_state()
        self.refresh_all("boot")
        return True

    async def _ticker(self) -> None:
        await asyncio.sleep(45)
        try:
            self.boot()
        except Exception:  # noqa: BLE001
            log.exception("market boot")
        while True:
            await asyncio.sleep(10 * 60)
            try:
                self.tick()
            except Exception:  # noqa: BLE001
                log.exception("market tick")

    # ── 生命周期 ──
    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self.ensure_loaded()
        if self._tick_task is None or self._tick_task.done():
            self._tick_task = self._loop.create_task(self._ticker())
        if self._has_work():
            self.kick()

    async def stop(self) -> None:
        for t in (self._tick_task, self._loop_task):
            if t and not t.done():
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
        self._tick_task = self._loop_task = None
        if self.http is not None:
            await self.http.aclose()
            self.http = None
        self._loop = None

    # ── 对外纯函数（路由与 MCP 共用）──

    def meta_for(self, db: Session, syms: list[str]) -> dict:
        """/api/market/meta 的返回体：已有的立刻给，缺的排队并列进 pending。"""
        self.ensure_loaded(db)
        lst = parse_syms(syms)
        names: dict = {}
        analyst: dict = {}
        tags: dict = {}
        earnings: dict = {}
        pending: list[str] = []
        ready = self.ready

        def need(x: str) -> None:
            if x not in pending:
                pending.append(x)

        for s in lst:
            if s in self.NAMES:
                names[s] = self.NAMES[s]
            elif ready:
                self.want(self.qn, "n", s)
                need(s)
            t = self.target(s)
            if t in self.ANA:
                if not self.ANA[t].get("none"):
                    analyst[t] = self.ANA[t]
            elif ready and self.coverable(t):
                self.want(self.qa, "a", t)
                need(t)
            # 标签只挂在正股/普通 ETF 上，杠杆 ETF 显示它正股的
            m = self.NAMES.get(s)
            tt = s if self.taggable(s) else (m["under"] if m and m.get("under") else None)
            if tt:
                tr = self.TAGS.get(tt)
                if tr:
                    tags[tt] = tr
                    # nofit 的先照旧返回（前端不至于闪空），同时排队重查一次
                    if ready and tr.get("auto") and tr.get("nofit") and self.taggable(tt):
                        self.want(self.qt, "t", tt)
                elif ready and self.taggable(tt):
                    self.want(self.qt, "t", tt)
                    need(tt)
            es = s if self.has_earnings(s) else (m["under"] if m and m.get("under") else None)
            if es and self.has_earnings(es):
                er = self.EARN.get(es)
                if er:
                    if not er.get("none"):
                        earnings[es] = er
                elif ready:
                    self.want(self.qe, "e", es)
                    need(es)
        if pending:
            self.kick()
        return {"names": names, "analyst": analyst, "tags": tags, "earnings": earnings,
                "tagSet": TAG_SET, "pending": pending, "ready": ready, "ts": now_ms()}

    def state(self) -> dict:
        return {
            "ready": self.ready, "running": self.running, "lastErr": self.last_err,
            "lastDaily": self.ST.get("lastDaily") or None,
            "queue": {"names": list(self.qn), "tags": list(self.qt), "earnings": list(self.qe), "analyst": list(self.qa)},
            "counts": {"names": len(self.NAMES), "analyst": len(self.ANA),
                       "tags": len(self.TAGS), "earnings": len(self.EARN)},
            "clients": len(self.clients),
        }

    def set_tags(self, db: Session, raw) -> dict:
        """手工调整标签（自动打完之后在界面上改的走这条）。"""
        self.ensure_loaded(db)
        raw = raw if isinstance(raw, dict) else {}
        out: dict[str, dict] = {}
        n = 0
        for k0, v in raw.items():
            k = str(k0).upper()
            if not ok_sym(k):
                continue
            n += 1
            if n > 200:
                continue
            lst = v if isinstance(v, list) else ((v.get("tags") if isinstance(v, dict) else None) or [])
            lst = lst if isinstance(lst, list) else []
            tags = [t for t in (str(x).strip() for x in lst) if t][:6]
            prev = self.TAGS.get(k)
            self.TAGS[k] = {"tags": tags, "note": (prev and prev.get("note")) or "", "at": now_ms()}
            out[k] = self.TAGS[k]
        if out:
            self._dump("tags", out, db)
            self.push({"tags": out})
        return {"ok": True, "tags": out}

    def refresh(self, db: Session, body) -> dict:
        """管理员手动刷新：给了 syms 就只排这些（按 names/tags/earnings/analyst 开关），否则全量。"""
        self.ensure_loaded(db)
        b = body if isinstance(body, dict) else {}
        syms = b.get("syms")
        if isinstance(syms, list) and syms:
            lst = [x for x in (str(s).upper() for s in syms) if ok_sym(x)][:60]
            for s in lst:
                if b.get("names"):
                    self.TRIED.pop("n:" + s, None)
                    self.want(self.qn, "n", s)
                if b.get("tags") and self.taggable(s):
                    self.TRIED.pop("t:" + s, None)
                    self.want(self.qt, "t", s)
                if b.get("earnings") and self.has_earnings(s):
                    self.TRIED.pop("e:" + s, None)
                    self.want(self.qe, "e", s)
                if b.get("analyst"):
                    t = self.target(s)
                    if self.coverable(t):
                        self.TRIED.pop("a:" + t, None)
                        self.want(self.qa, "a", t)
            self.kick()
            return {"ok": True, "queued": len(lst)}
        return {"ok": True, **self.refresh_all("manual", db)}


def parse_syms(syms) -> list[str]:
    """逗号串或列表 → 去重、大写、合法、最多 80 个。"""
    if isinstance(syms, str):
        syms = syms.split(",")
    seen: dict[str, None] = {}
    for x in syms or []:
        v = str(x or "").strip().upper()
        if ok_sym(v):
            seen[v] = None
    return list(seen)[:80]


svc = MarketMetaService()


# 模块级函数：给 MCP 与路由用的薄包装
def meta_for(db: Session, syms: list[str]) -> dict:
    return svc.meta_for(db, syms)


def target(sym: str) -> str:
    return svc.target(sym)


def state() -> dict:
    return svc.state()


def set_tags(db: Session, raw) -> dict:
    return svc.set_tags(db, raw)


def refresh(db: Session, body) -> dict:
    return svc.refresh(db, body)


def import_legacy(db: Session, names: dict | None, analyst: dict | None, tags: dict | None,
                  earnings: dict | None, state: dict | None) -> dict:
    """把旧 /data/market/*.json 的内容灌进表（迁移脚本调）。同键覆盖；内存缓存若已加载也一并更新。"""
    counts = {}
    for kind, src in (("names", names), ("analyst", analyst), ("tags", tags), ("earnings", earnings)):
        recs = {}
        for k, v in (src or {}).items():
            s = str(k).upper()
            if ok_sym(s) and isinstance(v, dict):
                recs[s] = dict(v)
        if recs:
            MarketMetaService._put_rows(db, kind, recs)
            if svc.loaded:
                svc._store(kind).update(recs)
        counts[kind] = len(recs)
    st = {k: v for k, v in (state or {}).items() if k == "lastDaily" and v}
    if st:
        kv = db.get(KV, STATE_KEY)
        merged = {**(dict(kv.value or {}) if kv else {}), **st}
        if kv:
            kv.value = merged
        else:
            db.add(KV(key=STATE_KEY, value=merged))
        db.commit()
        if svc.loaded:
            svc.ST.update(st)
    counts["state"] = len(st)
    return counts
