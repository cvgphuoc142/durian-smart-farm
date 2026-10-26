# Durian Admin

Simple admin UI for the `/v1/admin/*` API (see `../durianBackend/openapi.json`).

```bash
cp .env.example .env     # VITE_API_URL = backend origin (dev proxy)
npm install
npm run dev              # http://localhost:5174
```

Sign in with username + password (`POST /v1/auth/admin-login`). Dev seed (`make seed` in durianBackend): `admin` / `123456`.

Sections: Articles, Standards, Contacts, Chat reports. Content follows the
draft → in_review → approved → published workflow; translations create new revisions.
