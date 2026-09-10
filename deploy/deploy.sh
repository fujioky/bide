#!/usr/bin/env bash
# Deploy source and private configuration separately; never delete remote data.
set -euo pipefail
HOST=${DEPLOY_HOST:-deploy-host}
export RSYNC_RSH="ssh -o ControlMaster=auto -o ControlPath=/tmp/bide-deploy-%C -o ControlPersist=120 -o ServerAliveInterval=15"
SSH=(ssh -o ControlMaster=auto -o ControlPath=/tmp/bide-deploy-%C -o ControlPersist=120 -o ServerAliveInterval=15)
BIDE=$(cd "$(dirname "$0")/.." && pwd)
git -C "$BIDE" submodule update --init --recursive
NOTE=${NOTE_DIR:-$(dirname "$BIDE")/note}
EXCL=(--exclude .git --exclude __pycache__ --exclude .pytest_cache --exclude '*.pyc' --exclude node_modules --exclude build --exclude dist --exclude '*.egg-info')
"${SSH[@]}" "$HOST" 'mkdir -p /opt/bide /opt/note'
for dir in app agent quant deploy packages; do
  rsync -az "${EXCL[@]}" "$BIDE/$dir" "$HOST:/opt/bide/"
done
rsync -az "$BIDE/.dockerignore" "$HOST:/opt/bide/"
rsync -az "${EXCL[@]}" "$BIDE/secrets" "$BIDE/seed" "$HOST:/opt/bide/"
rsync -az "${EXCL[@]}" "$NOTE/app" "$NOTE/Dockerfile" "$NOTE/compose.yml" "$NOTE/.dockerignore" "$NOTE/seed" "$HOST:/opt/note/"
"${SSH[@]}" "$HOST" bash -s <<'REMOTE'
set -euo pipefail
find /opt/bide/secrets -type f -exec chmod 600 {} +
bash /opt/bide/deploy/seed.sh
cd /opt/bide/deploy
docker compose config --quiet
docker compose build
if [ ! -f /srv/bide/.migrated ]; then
  docker compose run --rm -T --interactive=false --no-deps -v /opt/bide/seed/blog:/seed:ro bide python -m bide.migrate /seed >/srv/bide/migration-report.json
  chmod 600 /srv/bide/migration-report.json
  touch /srv/bide/.migrated
fi
if [ ! -f /srv/note/.migrated ]; then
  docker compose run --rm -T --interactive=false --no-deps -v /opt/note/seed:/seed:ro note python -m note.migrate /seed
  touch /srv/note/.migrated
fi
docker compose up -d
docker compose ps
REMOTE
