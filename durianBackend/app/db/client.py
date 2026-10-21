from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import Settings


def make_client(settings: Settings) -> AsyncMongoClient:  # type: ignore[type-arg]
    # tz_aware: datetimes round-trip as UTC, never naive.
    return AsyncMongoClient(
        settings.mongo_uri,
        tz_aware=True,
        uuidRepresentation="standard",  # household ids are BSON UUID (subtype 4)
        serverSelectionTimeoutMS=settings.mongo_timeout_ms,
    )


def get_db(client: AsyncMongoClient, settings: Settings) -> AsyncDatabase:  # type: ignore[type-arg]
    return client[settings.mongo_db]
