"""bide.services.zones 与 blog/zones.cjs 的数值一致性测试。

对每个夹具（tests/fixtures/bars/*.json，3 年日线）分别用 node 跑原版 JS、用 Python
跑移植版，逐字段深度比较：数值容差 1e-9（相对或绝对），null ↔ None，
Infinity ↔ float('inf')（两边都先转成字符串 "Infinity" 再比）。

除了整段 3 年，还对若干前缀长度（每 25 根一个截止日）重复跑 analyze→waitOf→
rankOf→tierOf→notes，让 start/exit/各种 wait.pos 与档位分支都被覆盖到。

运行：cd app && uv run --with pytest --with duckdb pytest tests/test_zones_parity.py -q
"""
import json
import math
import os
import shutil
import subprocess
from functools import lru_cache

import pytest

from bide.services import zones as Z

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures", "bars")
ZONES_CJS = os.path.abspath(os.path.join(HERE, "fixtures", "zones.cjs"))
NODE = shutil.which("node") or "/home/fujio/.local/share/mise/installs/node/24/bin/node"
SYMBOLS = sorted(f[:-5] for f in os.listdir(FIXTURES) if f.endswith(".json"))
PREFIX_STEP = 25
PREFIX_MIN = 230   # 建仓区判定要求 j >= 220，从 230 起截止日才有意义

NODE_SCRIPT = r"""
'use strict';
const fs = require('fs');
const Z = require(process.argv[1]);
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const prefixes = JSON.parse(process.argv[3]);

function repl(k, v) {
  if (typeof v === 'number') {
    if (v === Infinity) return 'Infinity';
    if (v === -Infinity) return '-Infinity';
    if (Number.isNaN(v)) return 'NaN';
  }
  return v;
}
function chain(rs) {
  const a = Z.analyze(rs);
  const w = Z.waitOf(a);
  a.wait = w;                        // 看板/MCP 的调用方式：先挂 wait 再算 notes/rank
  const rank = Z.rankOf(a);
  return { analyze: a, wait: w, rank: rank, tier: Z.tierOf(rank), notes: Z.notes(a),
           okma: Z.okma(a), maWhy: Z.maWhy(a) };
}
function indicators(rs) {
  const dates = rs.map(r => r[0]), high = rs.map(r => r[2]), low = rs.map(r => r[3]), close = rs.map(r => r[4]);
  const ma5 = Z.sma(close, 5), ma20 = Z.sma(close, 20), ma60 = Z.sma(close, 60), ma200 = Z.sma(close, 200);
  const m = Z.macd(close), rsi = Z.rsi(close, 14), kd = Z.kdj(high, low, close);
  const xs = [].concat(Z.crosses(ma5, ma60, 'MA5 × MA60', dates))
                .concat(Z.crosses(ma60, ma200, 'MA60 × MA200', dates))
                .concat(Z.crosses(m.dif, m.dea, 'MACD DIF × DEA', dates));
  xs.sort((a, b) => a.i - b.i);
  const flags = rsi.map(v => v != null && v <= 30);
  return { ma5, ma20, ma60, ma200, ema10: Z.ema(close, 10), macd: m, rsi, kdj: kd, crosses: xs,
           flagZones: Z.flagZones(flags, null, 2, null),
           flagZonesGap3: Z.flagZones(flags, 3, null, null),
           bands: Z.bands(dates, rsi, xs, ma20, ma200, close) };
}
const out = { full: chain(rows), panel: Z.panel(rows), warms: Z.warms(rows),
              indicators: indicators(rows), prefixes: {},
              consts: { RSI_GAP: Z.RSI_GAP, RSI_HOT: Z.RSI_HOT, WAIT_MAX: Z.WAIT_MAX, ZN: Z.ZN },
              tiers: [0, 5, 10, 49, 50, 60, 66, 72, 75, 80, 81, 82, 83, 84, 88, 92, 100, 101].map(Z.tierOf) };
for (const n of prefixes) out.prefixes[String(n)] = chain(rows.slice(0, n));
process.stdout.write(JSON.stringify(out, repl));
"""


def _norm(v):
    """Python 结果 → 与 node 端相同的 JSON 形态（Infinity/NaN 转字符串、int 键转 str）。"""
    if isinstance(v, float):
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
        if math.isnan(v):
            return "NaN"
        return v
    if isinstance(v, dict):
        return {str(k): _norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_norm(x) for x in v]
    return v


def _diff(a, b, path="$"):
    """深度比较，返回第一个不一致的位置描述；完全一致返回 None。"""
    if isinstance(a, bool) or isinstance(b, bool):
        return None if (isinstance(a, bool) and isinstance(b, bool) and a == b) else f"{path}: {a!r} != {b!r}"
    if a is None or b is None:
        return None if a is b else f"{path}: {a!r} != {b!r}"
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return None if math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9) else f"{path}: {a!r} != {b!r}"
    if isinstance(a, str) and isinstance(b, str):
        return None if a == b else f"{path}: {a!r} != {b!r}"
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{path}: len {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = _diff(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            return f"{path}: keys {sorted(set(a) ^ set(b))} differ"
        for k in a:
            d = _diff(a[k], b[k], f"{path}.{k}")
            if d:
                return d
        return None
    return f"{path}: type {type(a).__name__} != {type(b).__name__}"


def _load(symbol):
    with open(os.path.join(FIXTURES, symbol + ".json"), encoding="utf-8") as f:
        return json.load(f)


def _prefixes(rows):
    """每 25 根一个截止日，再加上整段判定出的各区间的第一天与强势区终止日，
    保证 start/exit 这两个只在特定日子出现的分支被覆盖。"""
    n = len(rows)
    ends = set(range(PREFIX_MIN, n, PREFIX_STEP))
    zs = Z.analyze(rows)["zones"]
    for kind in ("a", "g", "b"):
        for z in zs[kind]:
            ends.add(z[0] + 1)
            if kind == "a":
                ends.add(z[1] + 1)
    return sorted(e for e in ends if PREFIX_MIN <= e < n)


@lru_cache(maxsize=None)
def _node(symbol):
    rows = _load(symbol)
    path = os.path.join(FIXTURES, symbol + ".json")
    r = subprocess.run([NODE, "-e", NODE_SCRIPT, "--", ZONES_CJS, path, json.dumps(_prefixes(rows))],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def _py_chain(rows):
    a = Z.analyze(rows)
    w = Z.wait_of(a)
    a["wait"] = w
    rank = Z.rank_of(a)
    return {"analyze": a, "wait": w, "rank": rank, "tier": Z.tier_of(rank), "notes": Z.notes(a),
            "okma": Z.okma(a), "maWhy": Z.ma_why(a)}


def _py_indicators(rows):
    dates, high, low, close = Z._series(rows)
    ma5, ma20, ma60, ma200 = Z.sma(close, 5), Z.sma(close, 20), Z.sma(close, 60), Z.sma(close, 200)
    m, rs, kd = Z.macd(close), Z.rsi(close, 14), Z.kdj(high, low, close)
    xs = Z._all_crosses(dates, close, ma5, ma60, ma200, m)
    flags = [v is not None and v <= 30 for v in rs]
    return {"ma5": ma5, "ma20": ma20, "ma60": ma60, "ma200": ma200, "ema10": Z.ema(close, 10),
            "macd": m, "rsi": rs, "kdj": kd, "crosses": xs,
            "flagZones": Z.flag_zones(flags, None, 2, None),
            "flagZonesGap3": Z.flag_zones(flags, 3, None, None),
            "bands": Z.bands(dates, rs, xs, ma20, ma200, close)}


def test_node_available():
    assert os.path.exists(NODE), NODE
    assert os.path.exists(ZONES_CJS), ZONES_CJS
    assert len(SYMBOLS) >= 8, SYMBOLS


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_full_chain(symbol):
    """整段 3 年：analyze → waitOf → rankOf → tierOf → notes（+ okma/maWhy）。"""
    js = _node(symbol)["full"]
    py = _norm(_py_chain(_load(symbol)))
    assert _diff(py, js) is None, _diff(py, js)


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_panel(symbol):
    js = _node(symbol)["panel"]
    py = _norm(Z.panel(_load(symbol)))
    assert _diff(py, js) is None, _diff(py, js)


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_warms(symbol):
    js = _node(symbol)["warms"]
    py = _norm(Z.warms(_load(symbol)))
    assert _diff(py, js) is None, _diff(py, js)


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_indicators_and_bands(symbol):
    """底层指标与 bands()/flagZones() 的直接输出（含 isG/isD 这类整型键对象）。"""
    js = _node(symbol)["indicators"]
    py = _norm(_py_indicators(_load(symbol)))
    assert _diff(py, js) is None, _diff(py, js)


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_prefix_chain(symbol):
    """按不同截止日重复跑一遍链路，覆盖 start/exit/wait.pos 的各个分支。"""
    rows = _load(symbol)
    js_all = _node(symbol)["prefixes"]
    for n in _prefixes(rows):
        js = js_all[str(n)]
        py = _norm(_py_chain(rows[:n]))
        d = _diff(py, js, f"$[{symbol}:{n}]")
        assert d is None, d


def test_constants_and_tiers():
    js = _node(SYMBOLS[0])
    assert js["consts"] == _norm({"RSI_GAP": Z.RSI_GAP, "RSI_HOT": Z.RSI_HOT, "WAIT_MAX": Z.WAIT_MAX, "ZN": Z.ZN})
    assert js["tiers"] == [Z.tier_of(r) for r in [0, 5, 10, 49, 50, 60, 66, 72, 75, 80, 81, 82, 83, 84, 88, 92, 100, 101]]


def test_js_helpers():
    """JS 舍入语义：Math.round 半数向 +∞，toFixed 半数取绝对值更大者。"""
    assert Z._js_round(2.5) == 3 and Z._js_round(-2.5) == -2 and Z._js_round(0.49999999999999994) == 0
    assert Z._js_to_fixed(0.25, 1) == "0.3" and Z._js_to_fixed(2.675, 2) == "2.67"
    assert Z._js_to_fixed(-0.0, 1) == "0.0" and Z._js_to_fixed(1.05, 1) == "1.1"
    assert Z._js_to_fixed(0.15, 1) == "0.1"   # 0.15 的 double 值略小于 0.15


def test_branch_coverage():
    """夹具 + 前缀截止日合起来至少要碰到这些档位，否则一致性测试形同虚设。"""
    seen = set()
    for s in SYMBOLS:
        js = _node(s)
        seen.add(js["full"]["tier"])
        for v in js["prefixes"].values():
            seen.add(v["tier"])
    # 「超卖区第一天」(83) 在原版 JS 里实际不可达：zLow 经 flagZones(minLen=2) 过滤，
    # 只有一根的段被丢掉，所以截止到第一天时区间尚不存在。其余 14 档都必须覆盖到。
    must = {"强势区终止 · 该清仓", "强势区进行中", "强势区第一天", "补票位 · 超卖区",
            "仍在超卖区价位", "超卖区进行中", "补票位 · 建仓区", "建仓区第一天", "建仓区进行中",
            "仍在建仓区价位", "区间外金叉", "高于建仓区", "其它", "死叉"}
    assert must <= seen, sorted(must - seen)
