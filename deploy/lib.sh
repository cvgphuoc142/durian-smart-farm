# Shared settings for the deploy scripts. Source it: `. deploy/lib.sh`.
# shellcheck shell=bash

SAURIENG_ROOT=${SAURIENG_ROOT:-/opt/saurieng-ai}
REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=$SAURIENG_ROOT/production.env
STATE_DIR=$SAURIENG_ROOT/state
PUBLIC_DIR=$SAURIENG_ROOT/public
MODELS_DIR=$SAURIENG_ROOT/models
BACKUP_DIR=$SAURIENG_ROOT/backups
LOG_DIR=$SAURIENG_ROOT/logs

ADMIN_DOMAIN=saurieng-ai.giaphuoccv.com
API_DOMAIN=api-saurieng-ai.giaphuoccv.com
MEDIA_DOMAIN=media-saurieng-ai.giaphuoccv.com
CERT_NAME=saurieng-ai
CERT_DIR=/etc/letsencrypt/live/$CERT_NAME
ACME_ROOT=/var/www/letsencrypt

# Image tag of the API currently deployed, unless the caller set one.
if [ -z "${RELEASE:-}" ] && [ -f "$STATE_DIR/release.env" ]; then
  # shellcheck disable=SC1091
  . "$STATE_DIR/release.env"
fi
export RELEASE=${RELEASE:-latest}

dc() {
  docker compose -p saurieng_ai -f "$REPO_DIR/deploy/compose.prod.yml" --env-file "$ENV_FILE" "$@"
}

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# nginx on Debian/Ubuntu reads sites-enabled; other layouts read conf.d.
nginx_site_path() {
  if [ -d /etc/nginx/sites-enabled ] && grep -rqs 'sites-enabled' /etc/nginx/nginx.conf; then
    echo /etc/nginx/sites-enabled/saurieng-ai.conf
  else
    echo /etc/nginx/conf.d/saurieng-ai.conf
  fi
}
