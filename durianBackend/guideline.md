# DurianOS Backend: Run & Test Guideline

## What the backend is

A FastAPI and MongoDB app for offline-first sync of household data. Phases 0-3 are done: sign-in and profile (Phase 1), money rules, and the sync and snapshot endpoints.

## How to run it

```bash
cd durianBackend
make up          # Mongo (Atlas-local, replica set) via docker
make seed        # load demo data (safe to repeat)
make dev         # API on http://localhost:8000
```

Open http://localhost:8000/docs for Swagger and sign in:

1. Run `POST /v1/auth/session` with `{"provider": "google", "id_token": "dev:demo"}`.
2. Copy the `token` from the response, click **Authorize** and paste it.

`dev:demo` is the seeded household (and an admin). `dev:<anything>` creates a fresh, empty household. The `dev:` tokens only work when `APP_ENV=dev`.

Other commands:

| Command | Purpose |
|---|---|
| `make reseed` | Wipe and reload the demo user's data |
| `make openapi` | Write `openapi.json` |
| `make test` | Run the suite (starts its own Mongo container) |
| `make check` | Lint, typecheck and test |
| `make down` | Stop the containers |

MinIO is not started by `make up`. Nothing uses it until Phase 5 (media), and its public image is no longer pullable. It sits behind the `storage` compose profile.

## What you can test

| Endpoint | Purpose |
|---|---|
| `GET /healthz`, `GET /readyz` | Liveness, and a Mongo ping |
| `POST /v1/auth/session` | Exchange a Google / Apple `id_token` for a session token |
| `POST /v1/auth/logout` | Revoke the calling session |
| `GET /v1/me` | User and preferences |
| `PUT /v1/me/locale` | `vi` or `en` |
| `PUT /v1/me/ai-consent` | `{"version": 1}` grants, `{"version": null}` withdraws |
| `DELETE /v1/me` | Erase the account, its rows and its sessions |
| `GET /v1/admin/me` | 200 for admins, 403 `admin_required` for everyone else |
| `POST /v1/sync` | Push mutations for 7 entities: farm, plot, season, care_log, expense, sale, sale_payment |
| `GET /v1/snapshot` | Everything the user owns, including deleted rows (tombstones) |

Every endpoint except `/healthz`, `/readyz` and `/v1/auth/session` needs `Authorization: Bearer <token>`.

Behaviours worth checking through `/v1/sync`:

- **Create vs update:** `expected_revision: null` creates a row. A number updates it, and a stale one returns `status: "conflict"` with the server's current row.
- **Idempotency:** resend the same `mutation_id` and you get the same answer. Reuse it with a different body and you get `mutation_id_reused`.
- **Atomic mutations:** the ops in one mutation commit together or not at all.
- **Soft delete:** `op: "delete"` sets `deleted_at` rather than removing the row.
- **Business rules** (each returns `status: "rejected"` with a code):
  - `duplicate_plot_name`
  - `open_season_exists`
  - `parent_not_found`
  - `care_input_required` (fertilizing or spraying with no inputs)
  - `expense_link_taken`
  - `confirmed_requires_total`
  - `refund_exceeds_receipts`
  - `has_live_children` (deleting a plot or season that still has live children)
  - `sale_has_payments`
- **Validation:** money is a string, dates are `YYYY-MM-DD`, and unknown fields are rejected.

## Seed data

The seed ([scripts/seed.py](scripts/seed.py)) goes through the real sync engine, so the rules and receipts apply to it. It creates one farm, 3 plots, 3 seasons, 3 care logs with inputs, 3 expenses (one linked to a care log) and 2 sales with 3 payments. It also deletes one plot, so the snapshot shows a tombstone.

## How to review it

1. **Seed result:**
   ```bash
   TOKEN=$(curl -s -X POST localhost:8000/v1/auth/session -H 'content-type: application/json' \
     -d '{"provider":"google","id_token":"dev:demo"}' | jq -r .token)
   curl -s localhost:8000/v1/snapshot -H "Authorization: Bearer $TOKEN" | jq
   ```
   The counts should be 1 farm, 3 plots, 3 seasons, 3 care logs, 3 expenses, 2 sales and 3 payments. One of the 3 plots has `deleted_at` set.
2. **Directly in Mongo:**
   ```bash
   docker exec -it durianbackend-mongo-1 mongosh durian --eval 'db.plots.find().pretty()'
   ```
   Rows carry `owner_id`, `revision` and `deleted_at`. `mutation_receipts` holds one receipt per mutation.
3. **Swagger examples:** `/v1/sync` has a dropdown with create farm, create plot, update with `expected_revision: 1`, and delete. Run them in that order. To see a conflict, send the update twice.
4. **Rejections:** try a duplicate plot name, a second open season on the same plot, or a refund bigger than the receipts.

## Sign-in and sessions

- The app sends a Google or Apple `id_token`. The backend checks its signature against the provider's public keys, plus `iss`, `aud` and `exp`, and takes the `sub` claim as the identity. Email is never used, so a Google and an Apple account are always separate users.
- The same provider subject always returns the same user, so a new phone gets its data back from `/v1/snapshot`.
- The session token is opaque and valid for 30 days (`SESSION_TTL_DAYS`). Only its hash is stored. Logout and account deletion remove it, which revokes it at once. There is no refresh token, because the contract has one token.
- Real tokens need the client IDs in `.env`: `GOOGLE_CLIENT_IDS='["<web or ios client id>"]'` and `APPLE_CLIENT_IDS='["<bundle id>"]'`. With none set, every real token is rejected with `invalid_provider_token`.
- Admin access is a row in `admin_members`. The seed grants it to the demo user. For anyone else, insert `{user_id: <uuid>}` in Mongo.

## Notes

- `APP_ENV` defaults to `prod`. `.env` sets `dev`, which enables the `dev:` tokens. Never set `dev` on a deployed server.
- The Mongo URI uses `directConnection=true` and no `replicaSet` name. The Atlas-local image names its replica set after the container ID.
