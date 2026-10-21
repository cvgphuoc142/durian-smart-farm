# Plan: DurianOS backend — FastAPI + MongoDB

## Context

The mobile app (`durianMobile`) and the web admin call one API. The contract is fixed in `docs/api_contract.json` (OpenAPI 3.1, 35 operations) and `docs/schema.json` (32 tables, entity/mutation/snapshot shapes). Scope comes from brief v0.2 (14/10/2026), deadline **28/10/2026**, one dev.

The docs were written for **Supabase Postgres + pgvector + RLS**. This plan keeps the **API contract unchanged** (the app must not notice) and re-implements the storage layer on **MongoDB**. Section 2 lists what does not map 1:1 and how each gap is closed.

**Out of scope here:** the web admin UI, the mobile app, the on-device model, store listing.

## 1. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | FastAPI (Python 3.12), Pydantic v2 | Contract is already OpenAPI; Pydantic models map from schema.json |
| Mongo driver | **PyMongo Async API** (`AsyncMongoClient`) | Official async driver, supports transactions and Atlas Vector Search; Motor is deprecated in its favour |
| Models | Pydantic v2 for wire + documents; no ODM | ODMs (Beanie) hide the transaction/session handling we need to control |
| DB | MongoDB 7+ **replica set** (Atlas, or local `rs0` in docker) | Multi-document transactions need a replica set; `/v1/sync` depends on them |
| Money | `decimal.Decimal` in code, **`Decimal128`** in Mongo, decimal strings on the wire | No floats anywhere (brief §1) |
| Auth | Verify Google / Apple `id_token` server-side, issue own short JWT + rotating refresh token | Supabase Auth is gone; subject = provider `sub`, never email |
| Media | S3-compatible bucket (S3 / R2 / MinIO in dev), presigned PUT/GET | Photos private per owner; Mongo holds metadata only |
| RAG | **Atlas Vector Search** (`$vectorSearch`) on `knowledge_chunk`, plus Atlas Search/`$text` for keyword fallback | Replaces pgvector; no separate vector DB (architecture rule) |
| LLM/embeddings | Provider behind an interface (`LlmClient`, `Embedder`); key server-side only | Provider/cost still an open question in the brief |
| Jobs | APScheduler in a separate worker process (daily reconcile, media GC, account deletion) | Avoids Celery/Redis for a one-dev scope |
| Rate limit | `slowapi` or Mongo-backed token bucket (per user, chat only) | 429 + `Retry-After` |
| Tooling | `uv`, `ruff`, `mypy`, `pytest` + `pytest-asyncio`, `httpx`, `testcontainers` (Mongo replica set), `schemathesis` | Contract tests against `api_contract.json` |
| Deploy | Docker image, `docker-compose` (api, worker, mongo rs, minio), env via `pydantic-settings` | |

**Local dev caveat:** Atlas Vector Search needs Atlas or the Atlas local image (`mongodb/mongodb-atlas-local`). Plain `mongo:7` runs everything except `$vectorSearch`. Plan: develop on `atlas-local` in compose; unit tests that touch retrieval use a fake `Retriever`.

## 2. Postgres → Mongo mapping (the risky parts)

| Docs assume | Mongo answer |
| --- | --- |
| RLS / FK-chain ownership | No RLS. **Denormalise `owner_id` onto every household document** (set by the server from the session, looked up through the parent on insert) and make every query go through a repository method that requires `owner_id`. One code path, tested for cross-household leaks (AC priority). Wrong-owner = `404 not_found`, same as missing |
| FKs / `restrict` | App-level checks inside the transaction (`parent_not_found`, `has_live_children`). Indexes on every parent key |
| Partial unique indexes (`WHERE deleted_at IS NULL`) | Mongo **partial unique indexes** with `partialFilterExpression: {deleted_at: null}`. `plot(farm_id,name)`, `season(plot_id)` where `closed_on` null, `expense(care_log_id)` where not null, `media_asset(owner_id, sha256)` |
| CHECK constraints | Pydantic validators + service-level rules; optional `$jsonSchema` collection validators as a second net |
| Transactions per mutation | `async with client.start_session()` + `with_transaction`; one transaction per mutation, `mutation_receipt` written in the same transaction |
| `numeric(18,2)` | `Decimal128`; quantise half-up in Python (`ROUND_HALF_UP`), never in the DB |
| Row `revision` + `expected_revision` | `find_one_and_update({_id, owner_id, revision: expected}, {$inc: {revision: 1}, ...})`; no match → read to tell `conflict` from `not_found` |
| `care_input` child table | **Embed** as `inputs[]` in `care_log` (wire shape already embeds it, replace-all on write). Removes a collection; sync/snapshot unchanged |
| `self_check` + `self_check_answer` | Embed answers in `self_check` (unique `season_id + standard_version_id`) |
| Translation tables | Embed translations by locale inside the version document (`translations: {vi: {...rev}, en: {...rev}}` with a revision list). Immutability enforced in the service layer |
| pgvector | `knowledge_chunk` docs with `embedding` + Atlas vector index, filtered by `release_no`, `locale`, `status=published` |
| Postgres FTS | Not needed server-side: FTS lives on the phone (content pack). Server only needs keyword fallback for RAG |

Result: **~24 collections** instead of 32 (care_input, self_check_answer and the 4 translation tables are embedded). IDs: household `_id` = the client UUID stored as a BSON UUID (binary subtype 4); content `_id` = server UUID. Stable codes stay strings.

## 3. Collections

**Household (all carry `owner_id`, `revision`, `created_at`, `updated_at`, `deleted_at`):**
`farms`, `plots`, `seasons`, `care_logs` (+`inputs[]`), `expenses`, `sales`, `sale_payments`, `disease_cases`, `media_assets`, `scans`, `self_checks` (+`answers[]`)

**Content (server-owned, versioned, immutable once published):**
`diseases`, `knowledge_articles`, `article_versions`, `knowledge_chunks`, `standard_profiles`, `standard_versions` (+`items[]` with translations), `directory_contacts`, `content_releases`

**Ops:** `users` (provider, subject, display_name; replaces `AUTH_USER`), `sessions` (refresh tokens, revocation), `user_preferences`, `admin_members`, `chat_reports`, `mutation_receipts` (unique `(user_id, mutation_id)`, `payload_hash`, stored result), `deletion_jobs`

## 4. Project layout

```
durianBackend/
├── pyproject.toml            # uv, ruff, mypy, pytest config
├── Dockerfile
├── docker-compose.yml        # api, worker, atlas-local, minio
├── .env.example
├── plan.md
├── contract/                 # symlink/copy of docs/api_contract.json + schema.json (source of truth for tests)
├── app/
│   ├── main.py               # create_app(), routers, middleware, lifespan (client, indexes)
│   ├── config.py             # pydantic-settings
│   ├── api/
│   │   ├── deps.py           # current_user, require_admin, db/session, locale
│   │   ├── errors.py         # ApiError + handlers → {request_id, code, message, retryable, field}
│   │   ├── middleware.py     # X-Request-Id, Accept-Language, access log (no tokens)
│   │   └── v1/
│   │       ├── auth.py       # POST /v1/auth/session (+ refresh/logout)
│   │       ├── me.py         # GET/DELETE /v1/me, PUT ai-consent, PUT locale
│   │       ├── snapshot.py   # GET /v1/snapshot
│   │       ├── sync.py       # POST /v1/sync
│   │       ├── media.py      # prepare, complete, {id}/access
│   │       ├── content.py    # manifest, releases/{no}, article-versions/{id}
│   │       ├── chat.py       # POST /v1/chat, /v1/chat/reports
│   │       └── admin/        # articles, standards, contacts, releases, chat_reports
│   ├── schemas/              # Pydantic: common types (Vnd, Kg, DateString…), entities, mutations, content, chat
│   ├── domain/
│   │   ├── money.py          # Decimal rules, half-up quantise, metrics (recorded_cost, receivable…)
│   │   ├── rules/            # per-entity business rules (season, care_log, expense, sale, payment, case, scan)
│   │   └── errors.py         # domain codes → x-errorCodes catalog
│   ├── sync/
│   │   ├── engine.py         # run mutations in order, transaction, receipts, dependency_failed
│   │   ├── handlers.py       # entity registry: upsert/delete per entity
│   │   └── receipts.py       # payload hash, replay
│   ├── repositories/         # owner-scoped data access, one per collection (all require owner_id)
│   ├── services/
│   │   ├── auth.py           # Google/Apple JWKS verification, JWT issue/refresh
│   │   ├── media.py          # presign, verify object hash/size
│   │   ├── content_release.py# build manifest + pack, atomic pointer swap
│   │   ├── rag.py            # retrieve → build prompt → LLM → citations → context_as_of
│   │   ├── llm.py            # LlmClient / Embedder protocols + provider impl
│   │   └── account.py        # delete account, revoke sessions, queue media cleanup
│   ├── db/
│   │   ├── client.py         # AsyncMongoClient, get_db
│   │   ├── indexes.py        # all indexes incl. partial unique; applied at startup / `make indexes`
│   │   └── codecs.py         # Decimal128 ↔ Decimal, UUID codec
│   └── worker/               # APScheduler: daily reconcile, retry index build, media GC, deletion jobs
├── scripts/                  # seed_diseases.py, create_admin.py, build_vector_index.py
└── tests/
    ├── unit/                 # money vectors, rules, hash/receipts
    ├── integration/          # real Mongo rs via testcontainers: sync, ownership, snapshot, media
    └── contract/             # schemathesis / OpenAPI response validation
```

## 5. Phases

Ordered so the app unblocks as early as possible. Each phase ends with its tests green.

### Phase 0 — Skeleton (½ day)
- `uv init`, FastAPI app, config, Docker compose with Mongo replica set (+ Atlas local) and MinIO, CI (ruff, mypy, pytest).
- Error model: `ApiError`, handlers for 401/403/404/409/422/429/503, `X-Request-Id`, no stack/secret leakage. Load the full code catalog from `x-errorCodes` into one enum.
- `GET /healthz`, `GET /readyz` (pings Mongo).
- Index bootstrap (`db/indexes.py`), idempotent.

### Phase 1 — Identity (1 day) · AC-17, FR-X01 — ✅ done

> Status: implemented and tested. Deviations: (1) the contract has one token, so sessions are **opaque 30-day bearer tokens** (sha256 in `sessions.token_hash`), not JWT + refresh; `POST /v1/auth/refresh` is skipped, `POST /v1/auth/logout` added; (2) `APP_ENV=dev` accepts `dev:<subject>` as an id_token for Swagger and the seed; (3) `DELETE /v1/me` hard-deletes household rows in one transaction and queues photo cleanup in `deletion_jobs`; (4) `require_admin` and `GET /v1/admin/me` exist, the rest of admin is Phase 4. Needs `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` in the environment for real sign-in.
- `POST /v1/auth/session`: verify Google (JWKS, `aud` = configured client IDs) and Apple (iOS only) `id_token`; upsert user by `(provider, sub)`; **never merge Google/Apple by email**; return access JWT (15 min) + refresh token (stored hashed in `sessions`).
- `POST /v1/auth/refresh`, `POST /v1/auth/logout` (additions, not in the contract — flag to the app dev; the contract only has `/session`. If the app expects one long-lived token, set a long TTL and skip refresh).
- `GET /v1/me`, `PUT /v1/me/locale`, `PUT /v1/me/ai-consent`.
- `DELETE /v1/me`: revoke sessions, tombstone-then-purge household docs, enqueue media deletion, return `DeletionStatus{media_pending}`.
- Admin guard: `require_admin` checks `admin_members`, never email.

### Phase 2 — Money rules + data layer (1 day) · AC-03…06 — ✅ done
- `domain/money.py`: `Vnd`/`Kg` parsing, half-up quantise to 0.01, derived metrics (`net_receipts`, `receivable`, `refund_due`, `forecast_profit`). Test with every vector in `schema.json` `x-derivedMetrics.testVectors` (incl. 1.005 kg × 1.00 = 1.01).
- Owner-scoped repositories; `Decimal128` codec; UUID codec.
- Pydantic models for entities, `EntityCreate`/`EntityPatch` (generated from schema.json where practical, hand-checked otherwise).

### Phase 3 — Core CRUD via `/v1/sync` + snapshot (3 days) · AC-01, 02, 03…06, 09 — **highest priority, highest risk** — ✅ done

> Status: implemented and tested against a real replica set (`tests/integration`). Deviations: (1) receipts are stored for **applied** mutations only — a rejected/conflicting mutation wrote nothing, so re-sending it is re-evaluated (lets the app fix a form and reuse the id); (2) `disease_case` / `scan` / `self_check` ops are rejected with `validation_failed` on `ops.N.entity` until Phase 5; `care_log.case_id` / `photo_id` already resolve against the (still empty) `disease_cases` / `media_assets` collections; (3) `current_user` in `app/api/deps.py` always answers 401 until Phase 1 — tests override it.
Scope: **farm → plot → season, care_log (+inputs), expense, sale, sale_payment**. Scan entities are deferred to Phase 5.
- Engine: for each mutation in order → check `mutation_receipts` (replay if same payload hash, `mutation_id_reused` if different) → open transaction → run ops → write receipt → commit. Per-mutation result `applied | conflict | rejected` inside HTTP 200. Limits 20 mutations / 50 ops.
- Handlers with the contract rules: `duplicate_plot_name`, `open_season_exists`, `season_mismatch`, `care_input_required`, `input_amount_unit_pair`, `expense_link_taken`, `expense_must_delete_with_care_log`, `confirmed_requires_total`, `refund_exceeds_receipts`, `sale_has_payments`, `has_live_children`, `parent_not_found`, `dependency_failed`.
- Revision check + tombstone delete (`deleted_at`, `revision + 1`). `owner_id`, `revision`, timestamps, `forecast_updated_at` are server-owned; client values ignored.
- Care log + expense in one mutation; delete care log with a live expense tombstones both.
- `GET /v1/snapshot`: all owner docs including tombstones, one `as_of` (scan/case/media arrays returned empty until Phase 5).
- Tests: retry after lost ack (no duplicate rows/payments), same id different payload, two clients editing one record from one revision (second gets `conflict`), cross-household access → 404/`parent_not_found`.
- Farm CRUD can be shipped first (farm/plot/season only) so the app's setup flow (SC-01, SC-02, SC-04) is unblocked on day 1 of this phase.
### Phase 4 — Content + admin (3 days) · AC-15, 23, 25
- Content model: article → immutable versions → translations by revision; standards (CN/fresh, EU/fresh) with items + source link + `source_checked_at`; contacts (≥1 channel). Workflow `draft → in_review → approved → published → unpublished`, `invalid_transition`, `not_approved`, `published_immutable`, `translation_incomplete`, `source_missing`, `contact_channel_required`.
- Admin endpoints (all 20 under `/v1/admin`), cursor pagination, `admin_required`.
- Release builder: on publish, build pack (vi + en text, hashes, tombstones) → insert `content_releases` → **swap the "current release" pointer in one transaction**; failure keeps the old release (`index_failed`, retry endpoint). Unpublish removes chunks from RAG immediately.
- `GET /v1/content/manifest`, `GET /v1/content/releases/{no}` (empty arrays, no sample data), `GET /v1/content/article-versions/{id}?locale&revision` (exact old text for citations).
- Fallback rule: missing translation → that version's source text with `is_fallback=true`, never an older version.
- `scripts/seed_diseases.py`: stable `disease.code` + vi/en names mapped to model class labels (needs the model team's class map).

### Phase 5 — Scan sync + media (lower priority, 2 days) · AC-08, 10, 12
- Sync handlers: `disease_case` upsert/delete, `scan` upsert (immutable except `case_id`: `scan_immutable`), `unknown_disease_code`, `media_not_found`; a scan mutation sends `[disease_case upsert?, scan upsert]` in one mutation. Snapshot now returns cases, scans, media.
- Media (prepare / complete / access) as below.
- `POST /v1/media/prepare`: idempotent on `asset_id` + sha256 (same id, different hash → 422); presigned PUT, `status=pending`.
- `POST /v1/media/complete`: HEAD/GET object, verify size + sha256 (`hash_mismatch`, `upload_incomplete` retryable), set `ready`; idempotent.
- `GET /v1/media/{id}/access`: owner-only short-lived presigned GET.
- Scan sync may reference a `pending` photo (metadata can arrive first); GC job removes never-completed assets after N days.

### Phase 6 — Chat / RAG (lowest priority, 2 days) · AC-13, 14, 20, 24
- `POST /v1/chat`: consent check **first** (`ai_consent_required`, nothing sent out) → rate limit → verify optional `season_id`/`case_id` ownership → retrieve published chunks (`$vectorSearch`, filter locale/release) → add the caller's synced season/case snapshot and server-computed finance totals → LLM → citations (`article_id, version_id, version_no, translation_revision, source_locale`) → `context_as_of` computed server-side. No history stored.
- Prompt hardening: article text, question and farm notes go in delimited data blocks; no tool that writes data; never send tokens, emails, original photos.
- Insufficient grounds → `status=insufficient_sources` with a suggested article. Errors: 429 with `Retry-After`, 503 `llm_unavailable`, never auto-retried server-side.
- `POST /v1/chat/reports` with `Idempotency-Key` (unique index); stores only what the farmer confirmed.
- Embedding pipeline: on publish, chunk → embed → write `knowledge_chunks` for the new release; build the vector index definition in `scripts/build_vector_index.py`.

### Phase 7 — Hardening and delivery (2 days)
- Contract tests: run `schemathesis` against the generated OpenAPI and diff FastAPI's `/openapi.json` against `docs/api_contract.json` (paths, status codes, error codes) in CI.
- Security pass: cross-household leak test over every endpoint, log redaction, CORS for web admin only, security headers, secrets via env.
- Load check on `/v1/sync` and `/v1/snapshot` with a realistic household (a few thousand rows).
- Daily job (FR-F07): reconcile approved content vs. releases, retry failed index builds. No crawling.
- Backups, Mongo user with least privilege, runbook for the `rs0`/Atlas setup, `README` with env vars and `make` targets.

## 6. Schedule against the deadline

| Days | Work |
| --- | --- |
| 15 Oct | Phase 0, start Phase 1 (auth) |
| 16 Oct | Phase 1 finished — app can sign in; Phase 2 money rules |
| 17–20 Oct | Phase 3 core CRUD (farm/plot/season first, then care, expense, sale, payment) + snapshot |
| 21–23 Oct | Phase 4 content + admin (non-AI) |
| 24–25 Oct | Phase 5 scan sync + media |
| 26 Oct | Phase 6 chat/RAG (needs LLM provider + embedding decision by 22 Oct) |
| 27 Oct | Phase 7 hardening, deploy production |
| 28 Oct | Delivery |

14 days is tight for one dev doing app + backend + admin. **Priority order:** auth and farm/season/finance CRUD first; scan sync and media next; chat/RAG last. **Cut order if behind:** (1) RAG (ship `/v1/chat` returning `llm_unavailable`, app falls back to local article search); (2) scan sync/media polish; (3) admin endpoints for contacts/standards via seed scripts instead of UI-driven; (4) refresh tokens. **Do not cut:** idempotent sync, ownership isolation, money rules, media hash verification (release-blockers per brief §5).

## 7. Decisions needed (they change the plan)

- [ ] **Hosting**: MongoDB Atlas (managed, gives Vector Search and replica set) vs self-hosted. Recommendation: Atlas — RAG needs Vector Search and transactions need the replica set.
- [ ] **Session design**: access+refresh JWT, or one long-lived token? The contract only defines `/v1/auth/session` (marked `assumed`). Confirm with the app dev (`durianMobile/src/api/endpoints/auth.ts`).
- [ ] **Object storage**: S3 vs Cloudflare R2 vs GCS; region (latency + data residency for VN farmers).
- [ ] **LLM + embedding provider**, cost per question and rate-limit numbers (open question in the brief).
- [ ] **Is the Supabase decision final?** The docs name Supabase Postgres (RLS, pgvector, FTS). This plan swaps it for Mongo as requested; the two risks are (a) ownership enforced only in app code and (b) relational integrity (FKs, CHECKs) moved into the service layer. Both are covered by Phase 3 tests, but they are weaker guarantees than the DB gave.
- [ ] Apple Sign-In bundle ID / Google client IDs for `aud` checks (owner: product owner / store service).
- [ ] Disease code list + model class map (needed for `unknown_disease_code` and `scan.disease_code`).

## 8. Definition of done

- Every operation in `api_contract.json` implemented or explicitly marked deferred, with matching status codes and error codes.
- All `testVectors` in `schema.json` pass; AC-03…06 reproduced by integration tests.
- Retry/replay and conflict tests pass against a real replica set.
- Cross-household access returns 404 on every endpoint; admin routes return 403 for normal users.
- Production deployed with TLS, Mongo replica set, private bucket, secrets outside the repo; request IDs in every error body.
