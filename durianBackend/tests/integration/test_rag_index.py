import asyncio
import uuid

from pymongo import AsyncMongoClient
from qdrant_client import AsyncQdrantClient

from app.rag.indexer import reindex
from app.rag.store import VectorRetriever, VectorStore


class FakeEmbedder:
    name = "fake:test:3"
    dimensions = 3

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, 0.0, 0.0] for _ in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [1.0, 0.0, 0.0]


def _release(articles: list[dict[str, object]]) -> dict[str, object]:
    return {
        "_id": uuid.uuid4(),
        "release_no": 1,
        "state": "current",
        "index_version": "idx-1",
        "index_state": "pending",
        "error": None,
        "pack": {"articles": articles},
    }


def _article() -> dict[str, object]:
    return {
        "id": str(uuid.uuid4()),
        "version_id": str(uuid.uuid4()),
        "version_no": 1,
        "title": "Nấm",
        "body": "Đoạn một.\n\nĐoạn hai.",
    }


def test_reindex_is_incremental_and_drops_unpublished(replset_uri: str) -> None:
    async def run() -> None:
        client = AsyncMongoClient(replset_uri, tz_aware=True, uuidRepresentation="standard")
        db = client[f"t_{uuid.uuid4().hex[:12]}"]
        store = VectorStore(AsyncQdrantClient(location=":memory:"), "chunks")
        emb = FakeEmbedder()
        art = _article()
        await db["content_releases"].insert_one(_release([art]))
        assert await reindex(db, emb, store) == 1
        assert await reindex(db, emb, store) == 0  # nothing new to embed
        assert (await db["content_releases"].find_one())["index_state"] == "ok"

        hits = await VectorRetriever(store, emb).search("nấm", 3)
        assert [h.version_id for h in hits] == [art["version_id"]]
        assert hits[0].article_id == art["id"] and hits[0].score > 0.99

        # unpublish: the next release has no articles → chunks vanish
        await db["content_releases"].update_one({}, {"$set": {"pack": {"articles": []}}})
        await reindex(db, emb, store)
        assert await store.count() == 0
        await client.close()

    asyncio.run(run())


def test_dimension_change_rebuilds_collection() -> None:
    async def run() -> None:
        store = VectorStore(AsyncQdrantClient(location=":memory:"), "chunks")
        await store.ensure(3)
        await store.ensure(5)  # different embedder → derived data is rebuilt, not mixed
        assert await store.count() == 0

    asyncio.run(run())
