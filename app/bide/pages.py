"""页面壳：门禁页、404。样式与旧 blog 的 shellPage 一致，走设计系统的 token。"""
from html import escape as esc
from urllib.parse import quote

from .config import settings

APP_TITLE = "bide"


def shell(title: str, inner: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="zh-CN" data-lyra-theme="home">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} · {APP_TITLE}</title>
<link rel="icon" href="/static/icon.svg">
<link rel="stylesheet" href="/ds/shell.css">
<link rel="stylesheet" href="/ds/tokens/fonts.css">
<link rel="stylesheet" href="/ds/tokens/base.css">
<style>
body{{background:var(--surface-page);color:var(--text-body);font-family:var(--font-body);
  min-height:100vh;display:flex;flex-direction:column;margin:0}}
main{{flex:1;display:grid;place-items:center;padding:var(--sp-8) var(--gutter-mobile)}}
.card{{max-width:460px;width:100%;padding:var(--sp-7);border-radius:var(--radius-4);
  background:var(--surface-raised);border:1px solid var(--border-hairline);
  box-shadow:var(--shadow-card);text-align:center}}
.card h1{{margin:0 0 var(--sp-3);font-size:var(--fs-h2);color:var(--text-heading);
  font-family:var(--font-mono-display);letter-spacing:.06em;font-weight:500;line-height:1.4}}
.card p{{margin:0 0 var(--sp-6);color:var(--text-muted);font-size:var(--fs-small);line-height:var(--lh-body)}}
.card a{{display:inline-block;padding:10px 22px;border-radius:var(--radius-2);
  background:var(--accent);color:var(--on-accent);text-decoration:none;
  font-size:var(--fs-small);font-weight:var(--weight-medium)}}
.card a.ghost{{background:transparent;color:var(--text-muted);
  border:1px solid var(--border-hairline);margin-left:var(--sp-2)}}
</style>
</head>
<body>
<header class="lyra-header">
  <a class="lyra-mark" href="/"><img src="/ds/assets/lyra-icon.svg" alt="">{APP_TITLE}</a>
  <nav><a href="/dashboard">看板</a></nav>
</header>
<main><div class="card">{inner}</div></main>
<footer class="lyra-footer"><div class="lyra-footer-in">
  <span>© 2026 example.com</span>
</div></footer>
</body>
</html>"""


def not_found() -> str:
    return shell("404", """
    <h1>404</h1>
    <p>没有这个页面。也可能它存在，只是不对你开放。</p>
    <a href="/">回首页</a>""")


def gate(what: str, who: str | None, next_path: str) -> str:
    back = quote(next_path or "/", safe="")
    if who:
        body = f"<p>你已登录为 {esc(who)}，但这一页不对你开放。</p><a href=\"/auth/logout?next={back}\">换个账号</a>"
    else:
        body = f"<p>这一页需要登录后才能看。</p><a href=\"/auth/login?next={back}\">登录</a>"
    if not settings.auth_ready and not who:
        body = "<p>登录还没有配置。</p>"
    return shell(what, f"<h1>{esc(what)}</h1>{body}<a class=\"ghost\" href=\"/\">回首页</a>")
