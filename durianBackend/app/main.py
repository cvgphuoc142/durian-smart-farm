import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import install_error_handlers
from app.api.middleware import RequestContextMiddleware
from app.api.v1 import admin, auth, content, health, me, sync
from app.auth.providers import ProviderVerifier, Verifier
from app.config import Settings, get_settings
from app.db.client import get_db, make_client
from app.db.indexes import ensure_indexes


def create_app(
    settings: Settings | None = None,
    *,
    bootstrap_indexes: bool = True,
    verifier: Verifier | None = None,
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = make_client(settings)
        app.state.client = client
        app.state.settings = settings
        app.state.verifier = verifier or ProviderVerifier(settings)
        app.state.db = get_db(client, settings)
        if bootstrap_indexes:
            try:
                await ensure_indexes(app.state.db)
            except Exception:
                # Do not crash-loop on a cold DB; /readyz reports the outage.
                logging.getLogger("durian").exception("index bootstrap failed")
        try:
            yield
        finally:
            await client.close()

    app = FastAPI(
        title="DurianOS API",
        version="0.1.0",
        lifespan=lifespan,
        description=(
            "Offline-first household data sync.\n\n"
            "**Dev sign-in (APP_ENV=dev):** call `POST /v1/auth/session` with provider "
            "`google` and id_token `dev:demo` (the seeded household), "
            "copy the `token`, click *Authorize* "
            "and paste it. `dev:<anything>` creates a fresh empty household."
        ),
        openapi_tags=[
            {"name": "Identity", "description": "Sign-in, profile, preferences, account deletion"},
            {"name": "Admin", "description": "Requires an admin_members row"},
            {"name": "ops", "description": "Liveness / readiness"},
            {"name": "Household data", "description": "Push mutations, pull snapshot"},
        ],
    )
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(me.router)
    app.include_router(me.admin_router)
    app.include_router(admin.router)
    app.include_router(content.router)
    app.include_router(sync.router)
    return app


app = create_app()
