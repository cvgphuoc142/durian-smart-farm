"""Chunk vectors live in their own vector DB (Qdrant), not in Mongo. One collection never mixes
embedding models: every point carries `embedding_model`, every query filters on it, and a
collection whose vector size differs from the embedder is rebuilt (it is derived data; the next
reindex refills it from the current release)."""

import logging
import uuid
from dataclasses import dataclass
from typing import Any, Protocol

from qdrant_client import AsyncQdrantClient, models

from app.config import Settings
from app.llm.base import Embedder

log = logging.getLogger("durian.rag")

_NAMESPACE = uuid.UUID("6f1b6c0e-2d6e-4a34-9a53-0f0a7a9a5d11")


@dataclass(frozen=True)
class Hit:
    article_id: str
    version_id: str
    version_no: int
    title: str
    text: str
    score: float


class Retriever(Protocol):
    async def search(self, query: str, k: int) -> list[Hit]: ...


def point_id(source_key: str, chunk_no: int) -> str:
    return str(uuid.uuid5(_NAMESPACE, f"{source_key}:{chunk_no}"))


def make_vector_store(settings: Settings) -> "VectorStore":
    if settings.qdrant_url == ":memory:":
        client = AsyncQdrantClient(location=":memory:")
    else:
        client = AsyncQdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            check_compatibility=False,
        )
    return VectorStore(client, settings.qdrant_collection)


class VectorStore:
    def __init__(self, client: AsyncQdrantClient, collection: str) -> None:
        self._client = client
        self.collection = collection

    async def close(self) -> None:
        await self._client.close()

    async def ensure(self, dimensions: int) -> None:
        if await self._client.collection_exists(self.collection):
            info = await self._client.get_collection(self.collection)
            vectors = info.config.params.vectors
            size = vectors.size if isinstance(vectors, models.VectorParams) else None
            if size == dimensions:
                return
            log.warning(
                "collection %s has %s dims but the embedder has %s; rebuilding",
                self.collection,
                size,
                dimensions,
            )
            await self._client.delete_collection(self.collection)
        await self._client.create_collection(
            self.collection,
            vectors_config=models.VectorParams(size=dimensions, distance=models.Distance.COSINE),
        )
        for field in ("source_key", "embedding_model"):
            await self._client.create_payload_index(
                self.collection, field, models.PayloadSchemaType.KEYWORD
            )

    async def source_keys(self, embedding_model: str) -> set[str]:
        keys: set[str] = set()
        offset: Any = None
        flt = models.Filter(
            must=[
                models.FieldCondition(
                    key="embedding_model", match=models.MatchValue(value=embedding_model)
                )
            ]
        )
        while True:
            points, offset = await self._client.scroll(
                self.collection,
                scroll_filter=flt,
                limit=256,
                offset=offset,
                with_payload=["source_key"],
                with_vectors=False,
            )
            keys |= {p.payload["source_key"] for p in points if p.payload}
            if offset is None:
                return keys

    async def delete_sources(self, source_keys: list[str]) -> None:
        if source_keys:
            await self._client.delete(
                self.collection,
                points_selector=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source_key", match=models.MatchAny(any=source_keys)
                        )
                    ]
                ),
            )

    async def delete_other_models(self, embedding_model: str) -> None:
        await self._client.delete(
            self.collection,
            points_selector=models.Filter(
                must_not=[
                    models.FieldCondition(
                        key="embedding_model", match=models.MatchValue(value=embedding_model)
                    )
                ]
            ),
        )

    async def clear(self) -> None:
        if await self._client.collection_exists(self.collection):
            await self._client.delete_collection(self.collection)

    async def upsert(self, points: list[models.PointStruct]) -> None:
        if points:
            await self._client.upsert(self.collection, points=points, wait=True)

    async def count(self) -> int:
        return (await self._client.count(self.collection, exact=True)).count

    async def search(self, vector: list[float], embedding_model: str, k: int) -> list[Hit]:
        resp = await self._client.query_points(
            self.collection,
            query=vector,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="embedding_model", match=models.MatchValue(value=embedding_model)
                    )
                ]
            ),
            limit=k,
            with_payload=True,
        )
        return [
            Hit(
                article_id=p.payload["article_id"],
                version_id=p.payload["version_id"],
                version_no=p.payload["version_no"],
                title=p.payload["title"],
                text=p.payload["text"],
                score=float(p.score),
            )
            for p in resp.points
            if p.payload
        ]


class VectorRetriever:
    """Embeds the question with the same embedder that indexed the chunks, then searches."""

    def __init__(self, store: VectorStore, embedder: Embedder) -> None:
        self._store = store
        self._embedder = embedder

    async def search(self, query: str, k: int) -> list[Hit]:
        vector = await self._embedder.embed_query(query)
        return await self._store.search(vector, self._embedder.name, k)
