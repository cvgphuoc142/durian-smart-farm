#!/usr/bin/env bash
# Seed articles, standards, contacts, the content release and the 3 scan models; optionally
# create or update an admin. Safe to re-run. Usage on the VPS:
#   bash deploy/seed.sh                         # content + models only
#   bash deploy/seed.sh --admin-file FILE       # FILE (mode 600) has SEED_ADMIN_USERNAME=.. and SEED_ADMIN_PASSWORD=..
# or export SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD before running.
set -Eeuo pipefail
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "run as root"
if [ "${1:-}" = --admin-file ]; then
  [ -f "${2:-}" ] || die "admin file not found"
  set -a; # shellcheck disable=SC1090
  . "$2"; set +a
fi
[ -f "$MODELS_DIR/manifest.json" ] || die "no $MODELS_DIR/manifest.json"

dc run --rm --no-deps -T \
  -v "$REPO_DIR/durianBackend/scripts:/srv/scripts:ro" \
  -v "$MODELS_DIR:/models:ro" \
  -e SEED_ADMIN_USERNAME -e SEED_ADMIN_PASSWORD \
  api python -m scripts.seed --models-dir /models
