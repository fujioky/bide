"""用一个假的 grok 可执行脚本跑通整个服务：/health、鉴权、/chat SSE、/json 抠 JSON 与串行、/status、登录流程。"""
import base64
import json
import os
import stat
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

ROOT = tempfile.mkdtemp(prefix='agent-test-')
HOME = os.path.join(ROOT, 'home')
BIN = os.path.join(ROOT, 'bin', 'grok')
LOG = os.path.join(ROOT, 'argv.log')
SHOTS = os.path.join(ROOT, 'shots')
RUNDIR = os.path.join(ROOT, 'run')
os.makedirs(os.path.dirname(BIN))
os.makedirs(HOME)
os.makedirs(RUNDIR)

FAKE = r'''#!/usr/bin/env bash
# 假 grok：把 argv 记到日志，按参数模拟各种行为
printf '%s\n' "$(printf '%s' "$*" | tr '\n' '|')" >> "$FAKE_LOG"
prompt=""; model=""; maxturns=""; cmd=""
while [ $# -gt 0 ]; do
  case "$1" in
    -p) prompt="$2"; shift 2;;
    -m) model="$2"; shift 2;;
    --max-turns) maxturns="$2"; shift 2;;
    --permission-mode) shift 2;;
    login) cmd=login; shift;;
    *) shift;;
  esac
done
if [ "$cmd" = login ]; then
  echo "Visit https://x.ai/device to sign in"
  echo "Your code: ABCD-EFGH"
  read -r line
  echo "got: $line"
  exit 0
fi
if [ -n "$maxturns" ]; then
  case "$prompt" in
    bad) echo "sorry, no structured answer here";;
    slow)
      touch "$FAKE_RUN/running.$$"
      ls "$FAKE_RUN" | grep -c '^running\.' >> "$FAKE_RUN/concurrency"
      sleep 0.4
      rm -f "$FAKE_RUN/running.$$"
      printf '{"n": 1}\n';;
    *) printf 'Sure, here you go:\n```json\n{"a": 1, "b": "x"}\n```\nAnything else?\n';;
  esac
  exit 0
fi
case "$prompt" in
  ping) echo pong;;
  fail) echo partial; echo "Error: boom" >&2; exit 2;;
  @*) printf '%s' "${prompt%%$'\n'*}";;
  *) printf 'hello'; sleep 0.1; printf ' world\n'; echo "debug: fine" >&2; sleep 0.1; echo "warning: failed to fetch cache" >&2;;
esac
'''
with open(BIN, 'w') as f:
    f.write(FAKE)
os.chmod(BIN, os.stat(BIN).st_mode | stat.S_IEXEC)

os.environ.update({
    'GROK_BIN': BIN, 'GROK_HOME': HOME, 'AGENT_SECRET': 's3cret', 'SHOT_DIR': SHOTS,
    'FAKE_LOG': LOG, 'FAKE_RUN': RUNDIR,
})
os.environ.pop('GROK_MODEL', None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

H = {'X-Agent-Secret': 's3cret'}


@pytest.fixture(scope='module')
def client():
    with TestClient(main.app) as c:
        yield c


def argv_log():
    with open(LOG) as f:
        return f.read().splitlines()


def frames(text):
    out = []
    for chunk in text.split('\n\n'):
        if not chunk:
            continue
        assert chunk.startswith('data: '), chunk
        out.append(chunk[len('data: '):])
    return out


# ── /health 与鉴权 ──
def test_health_no_auth(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json() == {'ok': True, 'bin': BIN, 'home': HOME}


@pytest.mark.parametrize('path,method', [
    ('/status', 'get'), ('/login', 'get'), ('/login/state', 'get'),
    ('/login/start', 'post'), ('/login/input', 'post'), ('/chat', 'post'), ('/json', 'post'),
])
def test_unauthorized(client, path, method):
    r = getattr(client, method)(path)
    assert r.status_code == 401
    assert r.json() == {'error': 'unauthorized'}
    r = getattr(client, method)(path + '?t=wrong')
    assert r.status_code == 401


def test_query_token_ok(client):
    assert client.get('/status?t=s3cret').status_code == 200


# ── /status ──
def test_status_without_auth_file(client):
    main.probe = {'at': 0.0, 'ok': False, 'why': '未检测'}
    d = client.get('/status', headers=H).json()
    assert d['installed'] is True and d['authed'] is False
    assert d['detail'] == '未登录：缺少 auth.json'
    assert d['bin'] == BIN and d['home'] == HOME and d['model'] is None
    assert isinstance(d['homeFiles'], list)


def test_status_with_auth_file(client):
    os.makedirs(os.path.join(HOME, '.grok'), exist_ok=True)
    with open(os.path.join(HOME, '.grok', 'auth.json'), 'w') as f:
        f.write('{}')
    main.probe = {'at': 0.0, 'ok': False, 'why': '未检测'}
    d = client.get('/status', headers=H).json()
    assert d['authed'] is True and d['detail'] == '已登录，实测可用'
    assert '.grok' in d['homeFiles']
    assert argv_log()[-1] == '-p ping'
    # 60 秒内走缓存，不再真跑 ping
    n = len(argv_log())
    d2 = client.get('/status', headers=H).json()
    assert d2['authed'] is True and len(argv_log()) == n


# ── /chat ──
def test_chat_requires_prompt(client):
    r = client.post('/chat', headers=H, json={})
    assert r.status_code == 400 and r.json() == {'error': 'prompt required'}


def test_chat_sse_framing(client):
    with client.stream('POST', '/chat', headers=H, json={'prompt': 'hi'}) as r:
        assert r.status_code == 200
        assert r.headers['content-type'].startswith('text/event-stream')
        assert r.headers['cache-control'] == 'no-cache, no-transform'
        assert r.headers['x-accel-buffering'] == 'no'
        text = ''.join(r.iter_text())
    fr = frames(text)
    assert fr[-1] == '[DONE]'
    objs = [json.loads(x) for x in fr[:-1]]
    deltas = [o['delta'] for o in objs if 'delta' in o]
    assert len(deltas) >= 2, deltas            # 分块到达，逐块吐帧
    assert ''.join(deltas) == 'hello world\n'
    errs = [o['err'] for o in objs if 'err' in o]
    assert errs == ['warning: failed to fetch cache\n']   # stderr 只有匹配到关键词的块才吐（按到达块匹配，与原版一致）
    assert argv_log()[-1] == '-p hi'


def test_chat_nonzero_exit(client):
    r = client.post('/chat', headers=H, json={'prompt': 'fail'})
    fr = frames(r.text)
    objs = [json.loads(x) for x in fr[:-1]]
    assert {'delta': 'partial\n'} in objs
    assert any(o.get('err', '').startswith('Error: boom') for o in objs)
    assert objs[-1] == {'err': 'exit 2'}
    assert fr[-1] == '[DONE]'


def test_chat_images_saved_and_referenced(client):
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32
    data_url = 'data:image/png;base64,' + base64.b64encode(png).decode()
    r = client.post('/chat', headers=H, json={'prompt': 'look', 'images': [data_url, 'not-a-data-url']})
    objs = [json.loads(x) for x in frames(r.text)[:-1]]
    line = ''.join(o.get('delta', '') for o in objs)
    assert line.startswith('@' + SHOTS + '/') and line.endswith('.png')
    path = line[1:]
    with open(path, 'rb') as f:
        assert f.read() == png
    assert argv_log()[-1].startswith('-p @' + SHOTS)


def test_sweep_shots():
    old = os.path.join(SHOTS, 'old.png')
    new = os.path.join(SHOTS, 'new.png')
    for p in (old, new):
        with open(p, 'wb') as f:
            f.write(b'x')
    os.utime(old, (time.time() - 7200, time.time() - 7200))
    main.sweep_shots()
    assert not os.path.exists(old) and os.path.exists(new)


# ── /json ──
def test_pick_json():
    assert main.pick_json('{"a":1}') == {'a': 1}
    assert main.pick_json('说明：\n```json\n{"a": 1}\n```\n完') == {'a': 1}
    assert main.pick_json('前面一句 [1, 2, {"x": "]"}] 后面一句') == [1, 2, {'x': ']'}]
    assert main.pick_json('先 {"bad": } 再 {"good": true} 完') == {'good': True}
    assert main.pick_json('nothing here') is None
    assert main.pick_json('') is None
    assert main.pick_json(None) is None
    assert main.pick_json('NaN') is None          # JSON.parse 不认 NaN
    # 原版先找 [] 再找 {}：对象里夹着数组、外面又有闲话时会先抠出数组，这个怪癖照搬
    assert main.pick_json('看：{"a": [1, 2]} 完') == [1, 2]


def test_json_extracts_and_passes_args(client):
    r = client.post('/json', headers=H, json={'prompt': 'plan', 'maxTurns': 5})
    assert r.status_code == 200
    d = r.json()
    assert d == {'ok': True, 'code': 0, 'json': {'a': 1, 'b': 'x'}}
    assert argv_log()[-1] == '-p plan --max-turns 5 --permission-mode bypassPermissions'


def test_json_defaults_and_clamps(client):
    client.post('/json', headers=H, json={'prompt': 'plan'})
    assert '--max-turns 24 ' in argv_log()[-1]
    client.post('/json', headers=H, json={'prompt': 'plan', 'maxTurns': 999})
    assert '--max-turns 60 ' in argv_log()[-1]
    client.post('/json', headers=H, json={'prompt': 'plan', 'maxTurns': 'abc'})
    assert '--max-turns 24 ' in argv_log()[-1]
    client.post('/json', headers=H, json={'prompt': 'plan', 'maxTurns': '3x'})
    assert '--max-turns 3 ' in argv_log()[-1]


def test_json_no_json_returns_raw(client):
    d = client.post('/json', headers=H, json={'prompt': 'bad'}).json()
    assert d['ok'] is False and d['json'] is None and d['code'] == 0
    assert 'no structured answer' in d['raw']
    assert 'err' not in d


def test_json_requires_prompt(client):
    r = client.post('/json', headers=H, json={'maxTurns': 3})
    assert r.status_code == 400 and r.json() == {'error': 'prompt required'}


def test_json_is_serialized(client):
    conc = os.path.join(RUNDIR, 'concurrency')
    if os.path.exists(conc):
        os.remove(conc)
    with ThreadPoolExecutor(3) as ex:
        t0 = time.time()
        rs = list(ex.map(lambda _: client.post('/json', headers=H, json={'prompt': 'slow'}), range(3)))
        dt = time.time() - t0
    assert all(r.json() == {'ok': True, 'code': 0, 'json': {'n': 1}} for r in rs)
    with open(conc) as f:
        seen = [int(x) for x in f.read().split()]
    assert len(seen) == 3
    assert max(seen) == 1, seen                 # 任一时刻只有一个 grok 在跑
    assert dt >= 1.2                            # 三个 0.4s 的任务串行执行


# ── 登录流程 ──
def test_login_page(client):
    r = client.get('/login?t=s3cret')
    assert r.status_code == 200
    assert r.headers['content-type'].startswith('text/html')
    assert "var T = 's3cret';" in r.text
    assert "join('\\n')" in r.text            # 模板里的换行转义要原样落到页面 JS 里
    assert '<title>Grok CLI 登录</title>' in r.text


def test_login_flow(client):
    assert client.get('/login/state', headers=H).json() == {'started': False}
    r = client.post('/login/input', headers=H, json={'text': 'x'})
    assert r.status_code == 409 and r.json() == {'error': '没有进行中的登录'}

    d = client.post('/login/start', headers=H).json()
    assert d['started'] is True and d['id']
    for _ in range(50):
        st = client.get('/login/state', headers=H).json()
        if st['code'] and st['url']:
            break
        time.sleep(0.05)
    assert st['started'] is True and st['done'] is False
    assert st['code'] == 'ABCD-EFGH'
    assert st['url'] == 'https://x.ai/device'
    assert st['lines'][0] == '$ grok login --device-auth'

    assert client.post('/login/input', headers=H, json={'text': 'hello'}).json() == {'ok': True}
    for _ in range(50):
        st = client.get('/login/state', headers=H).json()
        if st['done']:
            break
        time.sleep(0.05)
    assert st['done'] is True and st['error'] is None
    assert 'got: hello' in st['lines'] and st['lines'][-1] == '[exit 0]'
    assert st['authed'] is True
