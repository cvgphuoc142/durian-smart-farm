#!/usr/bin/env bash
# Put the API image and admin web back to the previous release. Data is not touched:
# if a migration already changed the data, restore a backup instead (see deploy/README.md).
set -Eeuo pipefail
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "run as root"
[ -f "$STATE_DIR/release.previous.env" ] || die "no previous release recorded"
CURRENT=$RELEASE
PREV=$(cut -d= -f2 "$STATE_DIR/release.previous.env")
docker image inspect "saurieng-api:$PREV" >/dev/null || die "image saurieng-api:$PREV is gone"
[ -f "$PUBLIC_DIR/releases/$PREV/index.html" ] || die "admin release $PREV is gone"

export RELEASE=$PREV
dc up -d --wait --wait-timeout 180 --no-build api
ln -sfn "releases/$PREV" "$PUBLIC_DIR/current.tmp"
mv -T "$PUBLIC_DIR/current.tmp" "$PUBLIC_DIR/current"
echo "RELEASE=$PREV" > "$STATE_DIR/release.env"
echo "RELEASE=$CURRENT" > "$STATE_DIR/release.previous.env"
log "rolled back $CURRENT -> $PREV"
