# Production deploy

Admin web, API and media storage run on one VPS behind the host's nginx:

| URL | Serves |
|---|---|
| `https://saurieng-ai.giaphuoccv.com` | Admin web, plus `/privacy/` and `/support/` |
| `https://api-saurieng-ai.giaphuoccv.com` | API (container `api`, `127.0.0.1:8000`) |
| `https://media-saurieng-ai.giaphuoccv.com` | MinIO (`127.0.0.1:9000`): photos and scan models via presigned URLs |

Mongo and Qdrant are not published. Everything lives under `/opt/saurieng-ai`:
`repo/` (this repository, branch `develop`), `production.env` (secrets, mode 600),
`public/releases/<commit>` + `public/current`, `models/`, `state/`, `backups/`, `logs/`.

Run commands on the VPS as root from `/opt/saurieng-ai/repo` unless noted.

## Update

```bash
git pull --ff-only && bash deploy/deploy.sh
```

`deploy.sh` backs up, builds the API image and the admin web for the current commit, replaces
the API once it is healthy, switches the admin web, reloads nginx after `nginx -t`, and runs a
smoke test. A failure stops it with the previous release still serving. Logs: `logs/deploy-*.log`.

## Secrets

The secrets file is never committed. On the Mac, edit `durianBackend/.env.production`
(template: `deploy/production.env.example`), then:

```bash
bash deploy/push-env.sh        # SAURIENG_HOST=<ssh host> to override the "saurieng-vps" alias
```

## Seed content, models and admin

```bash
bash deploy/seed.sh --admin-file /root/admin.env   # file: SEED_ADMIN_USERNAME=.. SEED_ADMIN_PASSWORD=..
```

Re-running is safe; running it with a new password changes that admin's password.
After seeding, rebuild the chatbot index: admin login, then `POST /v1/admin/releases/retry`.

## Backup, restore, rollback

- Daily at 03:30 by `saurieng-backup.timer`; manual: `bash deploy/backup.sh`. Keeps 7 in `backups/`.
- Restore Mongo: `. deploy/lib.sh; dc stop api; dc exec -T mongo mongorestore --archive --gzip --drop < backups/<time>/mongo.archive.gz; dc up -d --wait api`.
- Rollback code (no data change): `bash deploy/rollback.sh`.

## Inspect

```bash
. deploy/lib.sh
dc ps
dc logs --tail 100 api
```

## HTTPS

One certificate (`saurieng-ai`) covers the three hosts, issued with the webroot method so
certbot never edits nginx files. Renewal runs from certbot's timer and reloads nginx through
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`.
