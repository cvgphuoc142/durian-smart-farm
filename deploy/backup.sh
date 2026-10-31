#!/usr/bin/env bash
# Online backup of Mongo + MinIO + secrets into /opt/saurieng-ai/backups/<time>/, keeps 7.
# Qdrant is not backed up: it is rebuilt from Mongo by POST /v1/admin/releases/retry.
set -Eeuo pipefail
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "run as root"
umask 077
D=$BACKUP_DIR/$(date +%Y%m%d-%H%M%S)
install -d -m 700 "$D"

log "backup -> $D"
dc exec -T mongo mongodump --archive --gzip --quiet > "$D/mongo.archive.gz"
docker run --rm -v saurieng_ai_minio_data:/data:ro alpine:3.20 tar czf - -C /data . > "$D/minio.tgz"
cp "$ENV_FILE" "$D/production.env"
[ -d "$STATE_DIR" ] && tar czf "$D/state.tgz" -C "$STATE_DIR" --exclude deploy.lock .
(cd "$D" && sha256sum ./* > SHA256SUMS)

# Keep the 7 newest backups.
ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +8 | xargs -r rm -rf
log "backup done ($(du -sh "$D" | cut -f1))"
