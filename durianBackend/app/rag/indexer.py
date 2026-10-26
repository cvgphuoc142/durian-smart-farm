"""Keep the vector DB equal to what the current content release publishes.

Reconcile, not rebuild: chunks are keyed by article version, so a re-run embeds only what is
missing and drops what is no longer published (an unpublish leaves RAG as soon as this runs)."""

import logging
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase
from qdrant_client import models

from app.llm.base import Embedder
from app.rag.chunker import chunk_article
from app.rag.store import VectorStore, point_id

log = logging.getLogger("durian.rag")


async def reindex(db: AsyncDatabase, embedder: Embedder, store: VectorStore) -> int:  # type: ignore[type-arg]
    """Returns the number of chunks written. Marks the release `index_state` ok/failed."""
    release = await db["content_releases"].find_one({"state": "current"})
    try:
        await store.ensure(embedder.dimensions)
        if release is None:
            await store.clear()
            return 0
        articles = {str(a["version_id"]): a for a in release["pack"]["articles"]}
        await store.delete_other_models(embedder.name)
        have = await store.source_keys(embedder.name)
        await store.delete_sources(sorted(have - articles.keys()))
        written = 0
        for key, a in articles.items():
            if key in have:
                continue
            texts = chunk_article(a["title"], a["body"])
            if not texts:
                continue
            vectors = await embedder.embed_documents(texts)
            await store.upsert(
                [
                    models.PointStruct(
                        id=point_id(key, n),
                        vector=vec,
                        payload={
                            "source_key": key,
                            "article_id": str(a["id"]),
                            "version_id": key,
                            "version_no": a["version_no"],
                            "title": a["title"],
                            "chunk_no": n,
                            "text": text,
                            "embedding_model": embedder.name,
                            "index_version": release["index_version"],
                        },
                    )
                    for n, (text, vec) in enumerate(zip(texts, vectors, strict=True))
                ]
            )
            written += len(texts)
    except Exception as exc:  # embedder or vector DB down: record it, retry via /releases/retry
        log.error("reindex failed: %s", exc)
        if release is not None:
            await _mark(db, release["_id"], "failed", f"index_failed: {exc}"[:500])
        return 0
    await _mark(db, release["_id"], "ok", None)
    return written


async def _mark(db: Any, release_id: Any, state: str, error: str | None) -> None:
    await db["content_releases"].update_one(
        {"_id": release_id}, {"$set": {"index_state": state, "error": error}}
    )
