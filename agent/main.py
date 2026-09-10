"""grok-agent：包装 xAI grok CLI 的 HTTP 服务（FastAPI 版，自 Node/Fastify 移植）。"""
import asyncio
import base64
import codecs
import json
import logging
import os
import re
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from urllib.parse import quote

from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
log = logging.getLogger('grok-agent')

PORT = int(os.environ.get('PORT') or '8080')
SECRET = os.environ.get('AGENT_SECRET') or ''
HOME = os.environ.get('GROK_HOME') or os.environ.get('HOME') or '/data'
MODEL = os.environ.get('GROK_MODEL') or ''
BODY_LIMIT = 24 * 1024 * 1024

if not os.path.exists(HOME):
    try:
        os.makedirs(HOME, exist_ok=True)
    except OSError:
        pass

# ── CLI 装在持久卷 /data/.grok/bin，不在就自动装 ──
BIN_PATH = os.environ.get('GROK_BIN') or '/data/.grok/bin/grok'
BIN_DIR = os.path.dirname(BIN_PATH)
BIN = BIN_PATH if os.path.exists(BIN_PATH) else None

ENV = dict(os.environ)
ENV['HOME'] = HOME
ENV['GROK_BIN_DIR'] = BIN_DIR
ENV['PATH'] = BIN_DIR + ':' + (os.environ.get('PATH') or '')

_installing = None


async def _install():
    global BIN, _installing
    try:
        os.makedirs(BIN_DIR, exist_ok=True)
    except OSError:
        pass
    buf = b''
    code = None
    try:
        sh = await asyncio.create_subprocess_exec(
            'sh', '-c', 'curl -fsSL -m 90 https://x.ai/cli/install.sh -o /tmp/i.sh && bash /tmp/i.sh',
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            env={**ENV, 'HOME': HOME, 'GROK_BIN_DIR': BIN_DIR})
        buf, _ = await sh.communicate()
        code = sh.returncode
    except Exception as e:  # noqa: BLE001
        log.error('grok install spawn failed: %s', e)
        _installing = None
        return False
    if os.path.exists(BIN_PATH):
        BIN = BIN_PATH
    log.info('grok install code=%s ok=%s tail=%r', code, bool(BIN), buf.decode('utf-8', 'replace')[-500:])
    _installing = None
    return bool(BIN)


def install():
    """同一时刻只跑一份安装；调用方被取消不影响安装本身。"""
    global _installing
    if _installing is None:
        _installing = asyncio.ensure_future(_install())
    return asyncio.shield(_installing)


def _null_if_signal(rc):
    # Node 里被信号杀掉时 close 的 code 是 null；Python 给负数，这里对齐成 null
    return None if (rc is not None and rc < 0) else rc


async def run(args, timeout=20.0):
    if not BIN:
        return {'code': 127, 'out': '', 'err': 'grok CLI 未安装'}
    try:
        p = await asyncio.create_subprocess_exec(
            BIN, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=ENV)
    except Exception as e:  # noqa: BLE001
        return {'code': 1, 'out': '', 'err': str(e)}
    try:
        so, se = await asyncio.wait_for(p.communicate(), timeout)
    except asyncio.TimeoutError:
        try:
            p.kill()
        except ProcessLookupError:
            pass
        so, se = await p.communicate()
        return {'code': 1, 'out': so.decode('utf-8', 'replace')[:4 << 20],
                'err': se.decode('utf-8', 'replace') or f'timeout after {timeout}s'}
    code = p.returncode
    return {'code': code if code == 0 else (_null_if_signal(code) or 1),
            'out': so.decode('utf-8', 'replace')[:4 << 20], 'err': se.decode('utf-8', 'replace')}


# ── 登录态判定 ──
#    不解析 inspect 的文字（它未登录也返回 0），改为：
#    ① 卷里有 auth.json ② 真跑一次最小提问确认能出结果
AUTH_FILE = os.path.join(HOME, '.grok', 'auth.json')
probe = {'at': 0.0, 'ok': False, 'why': '未检测'}


async def login_state():
    global probe
    if not BIN:
        return {'installed': False, 'authed': False, 'detail': 'CLI 未安装'}
    if not os.path.exists(AUTH_FILE):
        probe = {'at': time.time(), 'ok': False, 'why': '没有 auth.json'}
        return {'installed': True, 'authed': False, 'detail': '未登录：缺少 auth.json'}
    # 探测结果缓存 60 秒，别每次刷新都烧一次额度
    if time.time() - probe['at'] < 60:
        return {'installed': True, 'authed': probe['ok'], 'detail': probe['why']}
    r = await run(['-p', 'ping'], timeout=45.0)
    blob = r['out'] + r['err']
    not_signed = re.search(r'not signed in|unauthenticated|login required|XAI_API_KEY', blob, re.I) is not None
    ok = r['code'] == 0 and not not_signed
    probe = {'at': time.time(), 'ok': ok,
             'why': '已登录，实测可用' if ok else ('未登录' if not_signed else 'CLI 退出码 ' + str(r['code']))}
    return {'installed': True, 'authed': ok, 'detail': probe['why'] + ('' if ok else '\n' + blob[:400])}


# ── 设备授权：跑 login，边跑边抓验证码与链接 ──
class LoginSession:
    def __init__(self):
        self.id = str(uuid.uuid4())
        self.proc = None
        self.lines = []
        self.code = None
        self.url = None
        self.done = False
        self.error = None
        self.task = None


session = None
LOGIN_TRIES = [['login', '--device-auth'], ['login', '--device-code'], ['login', '--manual-paste'], ['login']]


def _take(s, text):
    for ln in re.split(r'\r?\n', text):
        if ln.strip():
            s.lines.append(ln.strip())
    u = re.search(r'https?://[^\s"\'<>]+', text)
    if u and not s.url:
        s.url = u.group(0)
    c = re.search(r'\b([A-Z0-9]{4}[- ][A-Z0-9]{4})\b', text) or re.search(r'code[^A-Z0-9]{0,12}([A-Z0-9]{6,10})\b', text, re.I)
    if c and not s.code:
        s.code = c.group(1)
    if len(s.lines) > 300:
        del s.lines[:len(s.lines) - 300]


async def _login_run(s):
    for args in LOGIN_TRIES:
        s.lines.append('$ grok ' + ' '.join(args))
        try:
            p = await asyncio.create_subprocess_exec(
                BIN, *args, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE, env=ENV)
        except Exception as e:  # noqa: BLE001
            s.lines.append('[error] ' + str(e))
            continue
        s.proc = p
        saw = False

        async def pump(stream):
            nonlocal saw
            dec = codecs.getincrementaldecoder('utf-8')('replace')
            while True:
                b = await stream.read(4096)
                if not b:
                    break
                saw = True
                _take(s, dec.decode(b))

        await asyncio.gather(pump(p.stdout), pump(p.stderr))
        code = await p.wait()
        s.lines.append(f'[exit {code}]')
        if code == 0:
            s.done = True
            return
        if not saw or re.search(r'unknown|unrecognized|invalid|unexpected argument', '\n'.join(s.lines), re.I):
            s.error = None
            continue  # 换下一种 login 参数
        s.done = True
        s.error = '退出码 ' + str(code)
        return
    s.done = True
    s.error = s.error or '所有 login 变体都失败'


def start_login():
    global session
    if session and not session.done:
        return session
    s = LoginSession()
    session = s
    if not BIN:
        s.done = True
        s.error = 'grok CLI 未安装'
        return s
    s.task = asyncio.ensure_future(_login_run(s))
    return s


# ── 图片：写到临时目录，用 CLI 的 @路径 引用 ──
SHOT_DIR = os.environ.get('SHOT_DIR') or '/tmp/lyra-shots'
try:
    os.makedirs(SHOT_DIR, exist_ok=True)
except OSError:
    pass

_DATA_URL = re.compile(r'^data:image/(png|jpe?g|gif|webp);base64,(.+)\Z', re.I)


def save_shot(data_url, i):
    m = _DATA_URL.match(str(data_url or ''))
    if not m:
        return None
    ext = m.group(1).lower()
    ext = 'jpeg' if ext == 'jpg' else ext
    try:
        raw = m.group(2).rstrip('=')
        buf = base64.b64decode(raw + '=' * (-len(raw) % 4), altchars=b'-_')
    except Exception:  # noqa: BLE001
        return None
    if len(buf) > 8 * 1024 * 1024:
        return None
    p = f'{SHOT_DIR}/{int(time.time() * 1000)}-{i}-{uuid.uuid4().hex[:8]}.{ext}'
    with open(p, 'wb') as f:
        f.write(buf)
    return p


def sweep_shots():
    """半小时以上的临时图清掉"""
    try:
        now = time.time()
        for f in os.listdir(SHOT_DIR):
            p = SHOT_DIR + '/' + f
            if now - os.stat(p).st_mtime > 1800:
                try:
                    os.remove(p)
                except OSError:
                    pass
    except OSError:
        pass


async def _sweeper():
    while True:
        await asyncio.sleep(600)
        sweep_shots()


# ── 鉴权 ──
class Unauthorized(Exception):
    pass


def guard(request: Request):
    if not SECRET:
        return
    t = request.headers.get('x-agent-secret') or request.query_params.get('t')
    if t == SECRET:
        return
    raise Unauthorized()


class BodyTooLarge(Exception):
    pass


async def read_body(request: Request):
    raw = await request.body()
    if len(raw) > BODY_LIMIT:
        raise BodyTooLarge()
    if not raw.strip():
        return {}
    try:
        body = json.loads(raw)
    except ValueError:
        return None
    return body if isinstance(body, dict) else {}


@asynccontextmanager
async def lifespan(app):
    log.info('grok-agent :%s bin=%s home=%s', PORT, BIN if BIN else 'null', HOME)
    sweeper = asyncio.ensure_future(_sweeper())
    if not BIN:
        async def auto():
            ok = await install()
            log.info('auto-install grok: %s', ok)
        asyncio.ensure_future(auto())
    try:
        yield
    finally:
        sweeper.cancel()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(Unauthorized)
async def _unauth(request, exc):
    return JSONResponse({'error': 'unauthorized'}, status_code=401)


@app.exception_handler(BodyTooLarge)
async def _too_large(request, exc):
    return JSONResponse({'error': 'body too large'}, status_code=413)


# ── 路由 ──
@app.get('/health')
async def health():
    return {'ok': True, 'bin': BIN, 'home': HOME}


@app.get('/status', dependencies=[Depends(guard)])
async def status():
    if not BIN:
        await install()
    st = await login_state()
    try:
        files = os.listdir(HOME)
    except OSError:
        files = []
    return {**st, 'bin': BIN, 'home': HOME, 'homeFiles': files, 'model': MODEL or None}


@app.post('/login/start', dependencies=[Depends(guard)])
async def login_start():
    if not BIN:
        await install()
    s = start_login()
    return {'id': s.id, 'started': True}


@app.get('/login/state', dependencies=[Depends(guard)])
async def login_state_route():
    if not session:
        return {'started': False}
    st = await login_state()
    return {
        'started': True, 'done': session.done, 'error': session.error,
        'code': session.code, 'url': session.url,
        'lines': session.lines[-60:], 'authed': st['authed'],
    }


@app.post('/login/input', dependencies=[Depends(guard)])
async def login_input(request: Request):
    body = await read_body(request)
    text = (body or {}).get('text')
    s = session
    if not s or not s.proc or s.done or s.proc.stdin is None or s.proc.returncode is not None:
        return JSONResponse({'error': '没有进行中的登录'}, status_code=409)
    try:
        s.proc.stdin.write((str(text if text is not None else '') + '\n').encode('utf-8'))
        await s.proc.stdin.drain()
    except (BrokenPipeError, ConnectionResetError, OSError):
        return JSONResponse({'error': '没有进行中的登录'}, status_code=409)
    return {'ok': True}


def _sse(obj):
    return 'data: ' + json.dumps(obj, ensure_ascii=False) + '\n\n'


# ── 对话：headless -p，流式吐出 ──
@app.post('/chat', dependencies=[Depends(guard)])
async def chat(request: Request):
    if not BIN:
        await install()
    if not BIN:
        return JSONResponse({'error': 'grok CLI 未安装'}, status_code=503)

    body = await read_body(request)
    if body is None:
        return JSONResponse({'error': 'invalid json body'}, status_code=400)
    prompt = body.get('prompt')
    images = body.get('images', [])
    if not prompt:
        return JSONResponse({'error': 'prompt required'}, status_code=400)

    paths = []
    for i, d in enumerate(images[:4] if isinstance(images, list) else []):
        p = save_shot(d, i)
        if p:
            paths.append(p)

    full = ('\n'.join('@' + p for p in paths) + '\n\n' if paths else '') + str(prompt)[:60000]
    log.info('chat shots=%d', len(paths))

    args = ['-p', full]
    if MODEL:
        args += ['-m', MODEL]

    async def gen():
        try:
            p = await asyncio.create_subprocess_exec(
                BIN, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=ENV, cwd='/tmp')
        except Exception as e:  # noqa: BLE001
            yield _sse({'err': str(e)})
            return

        q = asyncio.Queue()

        async def pump(stream, kind):
            dec = codecs.getincrementaldecoder('utf-8')('replace')
            while True:
                b = await stream.read(65536)
                if not b:
                    break
                await q.put((kind, dec.decode(b)))
            tail = dec.decode(b'', final=True)
            if tail:
                await q.put((kind, tail))

        async def waiter():
            await asyncio.gather(pump(p.stdout, 'out'), pump(p.stderr, 'err'))
            await q.put(('close', await p.wait()))

        def kill():
            try:
                p.kill()
            except ProcessLookupError:
                pass

        w = asyncio.ensure_future(waiter())
        killer = asyncio.get_running_loop().call_later(120, kill)
        try:
            while True:
                kind, payload = await q.get()
                if kind == 'out':
                    yield _sse({'delta': payload})
                elif kind == 'err':
                    if re.search(r'error|failed|unauthor|login', payload, re.I):
                        yield _sse({'err': payload[:500]})
                else:
                    code = _null_if_signal(payload)
                    if code != 0:
                        yield _sse({'err': 'exit ' + ('null' if code is None else str(code))})
                    yield 'data: [DONE]\n\n'
                    break
        finally:
            killer.cancel()
            if p.returncode is None:
                kill()
            w.cancel()

    return StreamingResponse(gen(), media_type='text/event-stream', headers={
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    })


# ── 结构化任务：跑到底再一次性回 JSON ──
#    与 /chat 的区别有三个：
#    ① 不流式，等 CLI 跑完再回；
#    ② --max-turns 放开，允许它多轮联网搜索（-p 默认只走一轮，会出现「我先查一下」然后就结束）；
#    ③ --permission-mode bypassPermissions，否则 headless 下工具调用会因为没人批准而被取消。
#    CLI 很吃内存，2C/2G 的机器上同一时刻只让跑一个。
_chain = asyncio.Lock()

_MISSING = object()


def _reject_const(name):
    raise ValueError(name)


def _try_json(x):
    try:
        return json.loads(x, parse_constant=_reject_const)
    except (ValueError, TypeError, RecursionError):
        return _MISSING


def pick_json(text):
    """模型有时会在 JSON 前后带一句话，这里把最外层的 JSON 抠出来"""
    t = re.sub(r'```json|```', '', str(text or ''))
    whole = _try_json(t.strip())
    if whole is not _MISSING:
        return whole
    for a, b in (('[', ']'), ('{', '}')):
        i = t.find(a)
        while i >= 0:
            j = t.rfind(b)
            if j > i:
                v = _try_json(t[i:j + 1])
                if v is not _MISSING:
                    return v
            i = t.find(a, i + 1)
    return None


def _parse_int(v):
    """模仿 JS parseInt(v, 10)：取前导整数，取不到返回 None"""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v) if v == v and v not in (float('inf'), float('-inf')) else None
    m = re.match(r'\s*([+-]?\d+)', str(v))
    return int(m.group(1)) if m else None


def _num(v, default):
    try:
        f = float(v)
        return f if f == f else default
    except (TypeError, ValueError):
        return default


@app.post('/json', dependencies=[Depends(guard)])
async def json_job(request: Request):
    if not BIN:
        await install()
    if not BIN:
        return JSONResponse({'error': 'grok CLI 未安装'}, status_code=503)

    body = await read_body(request)
    if body is None:
        return JSONResponse({'error': 'invalid json body'}, status_code=400)
    prompt = body.get('prompt')
    max_turns = body.get('maxTurns', 24)
    timeout_ms = body.get('timeoutMs', 420000)
    if not prompt:
        return JSONResponse({'error': 'prompt required'}, status_code=400)

    t0 = time.time()
    async with _chain:
        args = ['-p', str(prompt)[:60000],
                '--max-turns', str(min(60, max(1, _parse_int(max_turns) or 24))),
                '--permission-mode', 'bypassPermissions']
        if MODEL:
            args += ['-m', MODEL]
        so, se = '', ''
        try:
            p = await asyncio.create_subprocess_exec(
                BIN, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=ENV, cwd='/tmp')
        except Exception as e:  # noqa: BLE001
            out = {'code': -1, 'so': '', 'se': str(e)}
        else:
            async def pump(stream, cap):
                dec = codecs.getincrementaldecoder('utf-8')('replace')
                acc = ''
                while True:
                    b = await stream.read(65536)
                    if not b:
                        break
                    if len(acc) < cap:
                        acc += dec.decode(b)
                return acc

            def kill():
                try:
                    p.kill()
                except ProcessLookupError:
                    pass

            killer = asyncio.get_running_loop().call_later(
                min(900000, max(30000, _num(timeout_ms, 420000))) / 1000, kill)
            try:
                so, se = await asyncio.gather(pump(p.stdout, 4_000_000), pump(p.stderr, 200_000))
                code = await p.wait()
            finally:
                killer.cancel()
                if p.returncode is None:
                    kill()
            out = {'code': _null_if_signal(code), 'so': so, 'se': se}

    js = pick_json(out['so'])
    log.info('json job ms=%d code=%s len=%d ok=%s', int((time.time() - t0) * 1000), out['code'], len(out['so']), js is not None)
    res = {'ok': js is not None, 'code': out['code'], 'json': js}
    if js is None:
        res['raw'] = out['so'][-3000:]
    err = (out['se'] or '')[-400:]
    if err:
        res['err'] = err
    return res


# ── 给人用的登录页 ──
LOGIN_HTML = r"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grok CLI 登录</title>
<style>
:root{--bg:#0d1117;--raised:#161b22;--line:#21262d;--fg:#e6edf3;--dim:#8b949e;--accent:#7aa2f7}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,'PingFang SC','Segoe UI',sans-serif;
  line-height:1.7;padding:32px 20px;display:flex;justify-content:center}
.w{max-width:640px;width:100%}
h1{font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px}
.sub{color:var(--dim);font-size:14px;margin-bottom:24px}
.card{background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px}
.k{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:10px}
button{padding:10px 18px;border-radius:6px;border:0;cursor:pointer;background:var(--accent);color:#0d1117;
  font-size:14px;font-weight:600;font-family:inherit}
button[disabled]{opacity:.45;cursor:default}
.code{font-family:ui-monospace,Menlo,monospace;font-size:30px;letter-spacing:.22em;color:var(--accent);
  padding:14px 0;word-break:break-all}
a{color:var(--accent);word-break:break-all}
pre{background:#010409;border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;
  max-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--dim);white-space:pre-wrap}
.ok{color:#3fb950}.bad{color:#f85149}
input{width:100%;padding:10px 12px;border-radius:6px;background:var(--bg);border:1px solid var(--line);
  color:var(--fg);font-family:ui-monospace,monospace;font-size:14px;margin-bottom:10px}
</style></head><body><div class="w">
<h1>Grok CLI</h1>
<p class="sub">在 Lyra 上完成设备授权。令牌存在持久卷，重新部署不会丢。</p>

<div class="card">
  <div class="k">状态</div>
  <div id="st">检查中…</div>
</div>

<div class="card">
  <div class="k">第一步 · 启动登录</div>
  <button id="go">开始</button>
  <div id="codebox" style="display:none">
    <div class="code" id="code"></div>
    <div>到这里输入上面的码：<a id="url" href="#" target="_blank" rel="noopener"></a></div>
  </div>
</div>

<div class="card" id="pastebox" style="display:none">
  <div class="k">如果它要你粘贴回调内容</div>
  <input id="paste" placeholder="把浏览器给你的码或整段回调 URL 粘进来">
  <button id="send">提交</button>
</div>

<div class="card">
  <div class="k">CLI 输出</div>
  <pre id="log">（未开始）</pre>
</div>
</div>
<script>
var T = '__T__';
var q = function (p) { return p + (p.indexOf('?') < 0 ? '?' : '&') + 't=' + T; };

function status() {
  fetch(q('/status')).then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById('st');
    if (!d.installed) el.innerHTML = '<span class="bad">CLI 未安装</span>';
    else if (d.authed) el.innerHTML = '<span class="ok">已登录，可以用了</span>';
    else el.innerHTML = '<span class="bad">未登录</span>';
  }).catch(function () {});
}
status();
setInterval(status, 5000);

document.getElementById('go').onclick = function () {
  this.disabled = true;
  fetch(q('/login/start'), { method: 'POST' }).then(poll);
};

function poll() {
  fetch(q('/login/state')).then(function (r) { return r.json(); }).then(function (d) {
    if (!d.started) return;
    document.getElementById('log').textContent = (d.lines || []).join('\n') || '（等待输出）';
    if (d.code) {
      document.getElementById('codebox').style.display = '';
      document.getElementById('code').textContent = d.code;
    }
    if (d.url) {
      document.getElementById('codebox').style.display = '';
      var a = document.getElementById('url');
      a.href = d.url; a.textContent = d.url;
    }
    document.getElementById('pastebox').style.display = '';
    if (!d.done) setTimeout(poll, 1200);
    else { status(); document.getElementById('go').disabled = false; }
  }).catch(function () { setTimeout(poll, 2000); });
}

document.getElementById('send').onclick = function () {
  var v = document.getElementById('paste').value;
  fetch(q('/login/input'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: v })
  }).then(function () { document.getElementById('paste').value = ''; poll(); });
};
</script></body></html>"""


@app.get('/login', dependencies=[Depends(guard)])
async def login_page(request: Request):
    # 对齐 JS 的 encodeURIComponent：字母数字与 -_.!~*'() 不转义
    t = quote(request.query_params.get('t') or '', safe="-_.!~*'()")
    return HTMLResponse(LOGIN_HTML.replace('__T__', t, 1))


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=PORT, log_level='info')
