import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import install_error_handlers
from app.api.middleware import RequestContextMiddleware
from app.api.v1 import admin, auth, chat, content, health, me, media, sync
from app.auth.providers import ProviderVerifier, Verifier
from app.config import Settings, get_settings
from app.content.migrate import migrate_single_locale
from app.db.client import get_db, make_client
from app.db.indexes import ensure_indexes
from app.llm.base import Embedder, LlmClient
from app.llm.factory import build_embedder, build_llm
from app.media.storage import ObjectStore, S3Store
from app.rag.store import Retriever, VectorRetriever, VectorStore, make_vector_store


def create_app(
    settings: Settings | None = None,
    *,
    bootstrap_indexes: bool = True,
    verifier: Verifier | None = None,
    llm: LlmClient | None = None,
    embedder: Embedder | None = None,
    retriever: Retriever | None = None,
    vector_store: VectorStore | None = None,
    storage: ObjectStore | None = None,
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = make_client(settings)
        app.state.client = client
        app.state.settings = settings
        app.state.verifier = verifier or ProviderVerifier(settings)
        app.state.db = get_db(client, settings)
        app.state.llm = llm or build_llm(settings)
        app.state.embedder = embedder or build_embedder(settings)
        emb = app.state.embedder
        app.state.vectors = vector_store or make_vector_store(settings)
        app.state.retriever = retriever or (
            VectorRetriever(app.state.vectors, emb) if emb is not None else None
        )
        app.state.storage = storage or S3Store(settings)
        if bootstrap_indexes:
            try:
                await ensure_indexes(app.state.db)
                await migrate_single_locale(app.state.db)
                if isinstance(app.state.storage, S3Store):
                    await app.state.storage.ensure_bucket()
            except Exception:
                # Do not crash-loop on a cold DB; /readyz reports the outage.
                logging.getLogger("durian").exception("index bootstrap failed")
        try:
            yield
        finally:
            await client.close()
            await app.state.vectors.close()

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
            {"name": "AI", "description": "Grounded chat (consent required) and answer reports"},
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
    app.include_router(media.router)
    app.include_router(chat.router)
    return app


app = create_app()
