#!/usr/bin/env bash
# First install and every update. Run as root from the repo on the VPS:
#   cd /opt/saurieng-ai/repo && git pull --ff-only && bash deploy/deploy.sh
# Any failure stops the script; the admin site and nginx keep the previous release.
set -Eeuo pipefail
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "run as root"
install -d -m 755 "$SAURIENG_ROOT" "$PUBLIC_DIR/releases" "$MODELS_DIR" "$ACME_ROOT"
install -d -m 700 "$STATE_DIR" "$BACKUP_DIR" "$LOG_DIR"

exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy is running"
LOG_FILE=$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log
exec > >(tee -a "$LOG_FILE") 2>&1
log "log: $LOG_FILE"

# --- Preflight
cd "$REPO_DIR"
[ "$(git rev-parse --abbrev-ref HEAD)" = develop ] || die "repo is not on develop"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "repo has local changes"
[ -f "$ENV_FILE" ] || die "missing $ENV_FILE (push it from the Mac: bash deploy/push-env.sh)"
[ "$(stat -c %a "$ENV_FILE")" = 600 ] || chmod 600 "$ENV_FILE"
grep -qx 'APP_ENV=prod' "$ENV_FILE" || die "production.env must contain APP_ENV=prod"
free_kb=$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2{print $4}')
[ "${free_kb:-0}" -gt 3000000 ] || die "less than 3 GB free for Docker"

NEW_RELEASE=$(git rev-parse --short=10 HEAD)
PREV_RELEASE=$RELEASE
log "release $NEW_RELEASE (previous: $PREV_RELEASE)"

# --- Backup before anything touches data (skipped on the very first run)
if docker volume inspect saurieng_ai_mongo_data >/dev/null 2>&1 && [ -n "$(dc ps -q mongo)" ]; then
  bash "$REPO_DIR/deploy/backup.sh"
fi

# --- MinIO's Chainguard image runs as uid 65532 and cannot write a root-owned volume.
if ! docker volume inspect saurieng_ai_minio_data >/dev/null 2>&1; then
  docker volume create saurieng_ai_minio_data >/dev/null
  docker run --rm -v saurieng_ai_minio_data:/data alpine:3.20 chown 65532:65532 /data
fi

# --- Build API image and admin web for this commit
export RELEASE=$NEW_RELEASE
dc build api
docker tag "saurieng-api:$RELEASE" saurieng-api:latest

OUT=$PUBLIC_DIR/releases/$RELEASE
if [ ! -f "$OUT/index.html" ]; then
  rm -rf "$OUT.tmp" && install -d "$OUT.tmp"
  docker run --rm \
    -v "$REPO_DIR/admin-frontend:/src:ro" -v "$OUT.tmp:/out" -v saurieng_ai_npm_cache:/root/.npm \
    -e VITE_API_BASE="https://$API_DOMAIN" node:22-alpine sh -euc '
      cp -a /src /build && cd /build && rm -rf node_modules dist
      npm ci --no-audit --no-fund && npm run build && cp -a dist/. /out/'
  [ -f "$OUT.tmp/privacy/index.html" ] || die "admin build has no privacy page"
  mv "$OUT.tmp" "$OUT"
fi

# --- Start services; the API is replaced only after the build succeeded
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
dc up -d --wait --wait-timeout 180 mongo qdrant minio
for _ in $(seq 30); do curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null && break; sleep 2; done
curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null || die "minio is not live"
if ! dc up -d --wait --wait-timeout 180 api; then
  dc logs --tail 80 api
  die "api did not become healthy"
fi
if dc logs --since "$started" api | grep -q 'index bootstrap failed'; then
  dc logs --since "$started" api | tail -40
  die "api started but index bootstrap failed"
fi
curl -fsS http://127.0.0.1:8000/readyz >/dev/null || die "readyz failed"

# --- Switch the admin web atomically
ln -sfn "releases/$RELEASE" "$PUBLIC_DIR/current.tmp"
mv -T "$PUBLIC_DIR/current.tmp" "$PUBLIC_DIR/current"

# --- nginx: the bootstrap file (HTTP only) until the certificate exists
SITE=$(nginx_site_path)
if [ -f "$CERT_DIR/fullchain.pem" ]; then CONF=saurieng-ai.conf; else CONF=saurieng-ai-bootstrap.conf; fi
OLD_TARGET=$(readlink "$SITE" 2>/dev/null || true)
ln -sfn "$REPO_DIR/deploy/nginx/$CONF" "$SITE"
if nginx -t; then
  systemctl reload nginx
else
  if [ -n "$OLD_TARGET" ]; then ln -sfn "$OLD_TARGET" "$SITE"; else rm -f "$SITE"; fi
  die "nginx -t failed; previous nginx config restored"
fi

# --- Daily backup timer (idempotent)
install -m 644 "$REPO_DIR"/deploy/systemd/saurieng-backup.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now saurieng-backup.timer >/dev/null

# --- Smoke test through nginx
if [ "$CONF" = saurieng-ai.conf ]; then
  curl -fsS "https://$API_DOMAIN/readyz" >/dev/null || die "https api smoke failed"
  curl -fsS -o /dev/null "https://$ADMIN_DOMAIN/" || die "https admin smoke failed"
  curl -fsS -o /dev/null "https://$ADMIN_DOMAIN/privacy/" || die "https privacy smoke failed"
  curl -fsS -o /dev/null "https://$MEDIA_DOMAIN/minio/health/live" || die "https media smoke failed"
else
  log "no certificate yet: HTTPS smoke skipped (see docs, certbot step)"
fi

# --- Record state, keep two releases
if [ "$PREV_RELEASE" != "$RELEASE" ] && [ "$PREV_RELEASE" != latest ]; then
  echo "RELEASE=$PREV_RELEASE" > "$STATE_DIR/release.previous.env"
fi
echo "RELEASE=$RELEASE" > "$STATE_DIR/release.env"
keep=("$RELEASE")
[ -f "$STATE_DIR/release.previous.env" ] && keep+=("$(cut -d= -f2 "$STATE_DIR/release.previous.env")")
for d in "$PUBLIC_DIR"/releases/*; do
  name=$(basename "$d")
  [[ " ${keep[*]} " == *" $name "* ]] || rm -rf "$d"
done
docker images --format '{{.Tag}}' saurieng-api | while read -r tag; do
  [[ "$tag" == latest || " ${keep[*]} " == *" $tag "* ]] || docker rmi "saurieng-api:$tag" >/dev/null || true
done
docker image prune -f >/dev/null

log "deployed $RELEASE"
