#!/usr/bin/env bash
# 在 deploy-host 上跑：准备数据卷与网络；只在卷为空时灌初始数据，幂等。
set -euo pipefail
ROOT=/opt/bide
for d in caddy/data caddy/config bide quant agent note; do mkdir -p /srv/$d; done
chmod 700 /srv/bide /srv/note /srv/agent
docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null

# quant：DuckDB 全库快照
if [ ! -f /srv/quant/quant.duckdb ]; then
  gzip -dc $ROOT/seed/quant/quant.duckdb.gz > /srv/quant/quant.duckdb.tmp
  mv /srv/quant/quant.duckdb.tmp /srv/quant/quant.duckdb
  echo "seed: quant.duckdb"
fi

# agent：grok CLI 的登录凭据
if [ ! -f /srv/agent/.grok/auth.json ]; then
  mkdir -p /srv/agent/.grok
  cp $ROOT/secrets/grok/auth.json $ROOT/secrets/grok/config.toml $ROOT/secrets/grok/agent_id /srv/agent/.grok/
  chmod 600 /srv/agent/.grok/auth.json
  echo "seed: grok credentials"
fi
