# Durian Admin

Simple admin UI for the `/v1/admin/*` API (see `../durianBackend/openapi.json`).

```bash
cp .env.example .env     # VITE_API_URL = backend origin (dev proxy)
npm install
npm run dev              # http://localhost:5174
```

Sign in with username + password (`POST /v1/auth/admin-login`). Dev seed (`make seed` in durianBackend): `admin` / `123456`.

Sections: Articles, Standards, Contacts, Scan models, Chat reports. Content follows the
draft → in_review → approved → published workflow. Each item has a single text (no per-language copies).

## Scan models

Upload a model entry (JSON, without the file) and its `.onnx`; the page hashes the file in the browser,
registers a draft, sends the file straight to object storage with a presigned PUT, and the server verifies
size and sha256. Publish makes it the live model of its body part (it replaces the previous one). Phones
see it in `GET /v1/models/manifest` and download it only when the farmer taps "Tải về". Re-publishing an
older version is the server-side rollback.

The browser PUTs to the storage endpoint, so the bucket needs a CORS rule allowing `PUT` from the admin
origin (MinIO: `mc anonymous`-free; set `MINIO_API_CORS_ALLOW_ORIGIN`). Without it use
`uv run python -m scripts.publish_models` in `durianBackend`, which uploads from the server side.
