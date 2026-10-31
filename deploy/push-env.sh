#!/usr/bin/env bash
# Run on the Mac. Copies durianBackend/.env.production (never committed) to the VPS as
# /opt/saurieng-ai/production.env (mode 600) and restarts the API if it is running.
# Host: $SAURIENG_HOST, default the ssh alias "saurieng-vps".
# Changing S3_ACCESS_KEY / S3_SECRET_KEY after the first deploy also needs a MinIO restart.
set -Eeuo pipefail

HOST=${SAURIENG_HOST:-saurieng-vps}
SRC=$(cd "$(dirname "$0")/.." && pwd)/durianBackend/.env.production

[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
grep -qx 'APP_ENV=prod' "$SRC" || { echo "$SRC must contain APP_ENV=prod" >&2; exit 1; }
git -C "$(dirname "$SRC")" check-ignore -q "$SRC" || { echo "$SRC is not git-ignored" >&2; exit 1; }

TMP=/root/.production.env.upload
scp -q "$SRC" "$HOST:$TMP"
ssh "$HOST" "set -e
  install -d -m 755 /opt/saurieng-ai
  install -m 600 -o root -g root $TMP /opt/saurieng-ai/production.env && rm -f $TMP
  cd /opt/saurieng-ai/repo 2>/dev/null || exit 0
  . deploy/lib.sh
  if [ -n \"\$(dc ps -q api 2>/dev/null)\" ]; then dc up -d --wait --force-recreate --no-build api; fi"
echo "production.env pushed to $HOST"
