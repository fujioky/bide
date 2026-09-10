# bide

自用的美股看板与行情/回测服务，Python 单栈，部署在 deploy-host（192.0.2.10，示例区域）。
博客拆成了独立项目 [note](https://github.com/fujioky/note)，与本仓库共用同一台机器和同一个 Caddy。

## 域名

| 域名 | 服务 | 说明 |
|---|---|---|
| bide.example.com | app/ | 看板、关注/星标/订单、行情元数据、Bitget、登录 |
| mcp.bide.example.com | app/ | 给 AI 客户端的只读 MCP（同一进程，按 Host 分流） |
| quant.bide.example.com | quant/ | 日线/期权/财报缓存、回测、公开行情接口 |
| note.example.com | note 仓库 | 博客 |
| auth.example.com | Logto Cloud | 登录提供方，两个应用都是它的 OIDC 客户端 |

`mcp.bide` 和 `quant.bide` 使用仅 DNS 记录，由 Caddy 管理源站证书。

## 目录

| 目录 | 内容 |
|---|---|
| `app/` | bide 应用（FastAPI + SQLite）。`bide/routers` 按功能分：`lists` 关注/星标/订单/已读、`dashboard` 看板页、`market` 元数据、`bitget`、`mcp`、`notify`。`bide/services/zones.py` 是区间与档位判定的 Python 实现，与浏览器端 `static/zones.js` 用 `tests/test_zones_parity.py` 逐值对比 |
| `quant/` | 行情与回测服务（FastAPI + DuckDB + backtrader），只认 `X-API-Key` |
| `agent/` | 包装 grok CLI 的小服务，给 note 的文章问答和 bide 的元数据抓取用 |
| `deploy/` | `compose.yml`、`Caddyfile`、`deploy.sh`（本机执行）、`seed.sh`（deploy-host 上执行） |
| `seed/` | 从旧系统带过来的初始数据：`blog/` 是旧 blog 持久卷备份，`quant/quant.duckdb.gz` 是 DuckDB 全库 |
| `secrets/` | 环境变量与 grok 登录凭据。仅存于本地和服务器，不提交到公开仓库 |
| `docs/` | 运维记录、界面交接文档、旧系统的备份手册 |

## 部署

```sh
deploy/deploy.sh          # 同步 bide + note 到 deploy-host，构建，启动；首次自动灌数据

```

deploy-host 上：代码在 `/opt/bide` 与 `/opt/note`，数据卷在 `/srv/<服务>`，Caddy 自动签证书。
备份只需要 `/srv/bide/bide.db`、`/srv/note/`、`/srv/quant/quant.duckdb`、`/srv/agent/.grok/auth.json`。

## 本地开发

```sh
cd app
DATA_DIR=/tmp/bide DEV_LOGIN=1 SESSION_SECRET=x uv run --with ../packages/fujioky-auth --with-requirements requirements.txt uvicorn bide.main:app --reload
# 打开 http://127.0.0.1:8000/auth/dev?email=you@example.com&admin=1 直接得到一个管理员会话
uv run --with ../packages/fujioky-auth --with-requirements requirements.txt --with pytest --with pytest-asyncio --with duckdb pytest -q
```

## 登录

标准 OIDC（Authorization Code + PKCE）。`OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` 指向 Logto；回调地址 `https://bide.example.com/auth/callback`。
管理员 = 邮箱在 `ADMIN_EMAILS` 里。从旧系统迁来的用户只有邮箱，第一次登录按邮箱认领。

## 与旧系统的对应

旧系统的备份与密钥不随源码发布。对应关系：blog-spa → note + bide；invest-quant → quant；grok-agent → agent；sso + sso-db（Casdoor + Postgres）→ Logto Cloud；status-suel、landing-bik 不再保留。

## MCP 用户授权

Claude / ChatGPT 连接地址：`https://mcp.bide.example.com/mcp`，选择 OAuth。
授权服务器是 BIDE（`https://bide.example.com`），支持自动客户端注册（DCR）。
若客户端让你选择注册方式，选择动态客户端注册；无需手动提供 BIDE 的 Logto App Secret。
Logto 仍只负责 BIDE 的网页登录，沿用已有应用及 `/auth/callback` 回调。
不需要额外 Logto MCP 应用、API Resource 或订阅；无需把 Claude / ChatGPT 回调加到 Logto。

首次连接会跳转 BIDE：登录 → 查看客户端名称、回调地址及读取范围 → 明确允许或取消。
客户端名称是注册方自报的，授权页会同时展示实际回调地址，不能只靠名称判断身份。
私有数据（关注、星标、手工订单、按关注列表搜索/排序）按授权用户 ID 隔离；行情、期权、财报和指标为公共数据。
MCP 不暴露共享券商账户和任意 Python 执行工具，所有工具只读。

用户在 `/oauth/connections`（已授权应用）撤销连接。撤销立即使整组令牌失效。
授权码有效 2 分钟且只能使用一次；强制 S256 PKCE；访问令牌有效 1 小时。
请求 `offline_access` 时启用旋转刷新令牌，授权最长 30 天；重复使用旧刷新令牌会撤销整组授权。
令牌只保存 SHA256 摘要，授权绑定客户端、用户和 MCP resource；所有状态保存在现有 SQLite 中。
旧 `MCP_OIDC_*`、`MCP_ALLOW_SUBS`、`MCP_ACT_AS` 已移除，旧 Auth0 / Logto token 均不能直接访问 MCP。

生产需设置强随机 `SESSION_SECRET` 并关闭 `DEV_LOGIN`。
Logto 登录需要已验证邮箱才能认领旧用户数据，已绑定其他 subject 的邮箱不自动覆盖。
发布前需用 Claude / ChatGPT 各完成一次真实登录、授权、查询和撤销；本地测试不替代云端联调。

## 可复用的 Logto 登录组件

`packages/fujioky-auth` 是独立 Python 包；BIDE/NOTE 各自只保留薄接入层和业务权限规则。
组件包含服务端会话、加密令牌存储、自动刷新、统一退出、后端注销、设备管理和 Logto 账号中心入口。
完整的新应用接入方法及 Logto 控制台配置表见 [组件说明](packages/fujioky-auth/README.md)。
新的网页登录会话最长 14 天，旧的签名 cookie 需要重新登录一次。
明确退出设备或收到 Logto 注销通知时，BIDE 会同时撤销该设备创建的 MCP 授权。
普通会话自然到期不撤销已批准的离线 MCP 授权；仍可在“已授权应用”中单独撤销。

## Public source and private deployment inputs

The public repository contains application source only. Supply your own `secrets/env/*.env`, optional legacy `seed/blog`, `seed/quant/quant.duckdb.gz`, and Grok credentials before running the migration deployment script. Never commit these files. Each test module currently requires a separate pytest process because configuration is loaded at import time.
