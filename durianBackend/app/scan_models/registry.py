"""The scan models the phones may download.

Collection `model_versions`: one row per uploaded model file, `entry` (the manifest entry without
its file), `artifact` (object key, sha256, size), `status` draft | published | unpublished.
At most one version per body part is published; the manifest is exactly those rows, so adding a
label, a healthy class or a whole new body part is a publish, never an app release.
"""

import hashlib
import json
from datetime import datetime
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.sync.receipts import iso, utcnow_ms

SCHEMA_VERSION = 1
COLLECTION = "model_versions"


def object_key(version_id: Any) -> str:
    return f"models/{version_id}.onnx"


def artifact_wire(doc: dict[str, Any]) -> dict[str, Any]:
    a = doc["artifact"]
    return {
        "path": f"{doc['entry']['plant_part']}-{doc['entry']['version'][:8]}.onnx",
        "sha256": a["sha256"],
        "size_bytes": a["size_bytes"],
    }


def manifest_entry(doc: dict[str, Any]) -> dict[str, Any]:
    return {**doc["entry"], "artifact": artifact_wire(doc)}


def revision_of(entries: list[dict[str, Any]]) -> str:
    canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


async def build_manifest(db: AsyncDatabase) -> dict[str, Any]:  # type: ignore[type-arg]
    rows = (
        await db[COLLECTION]
        .find({"status": "published", "artifact.status": "ready"})
        .sort([("entry.plant_part", 1)])
        .to_list(None)
    )
    entries = [manifest_entry(r) for r in rows]
    newest: datetime | None = max((r["published_at"] for r in rows), default=None)
    return {
        "schema_version": SCHEMA_VERSION,
        "revision": revision_of(entries),
        "published_at": iso(newest) if newest else None,
        "entries": entries,
    }


async def publish(db: AsyncDatabase, doc: dict[str, Any]) -> None:  # type: ignore[type-arg]
    """Make `doc` the live model of its body part; the one it replaces is unpublished."""
    now = utcnow_ms()
    await db[COLLECTION].update_many(
        {
            "status": "published",
            "entry.plant_part": doc["entry"]["plant_part"],
            "_id": {"$ne": doc["_id"]},
        },
        {"$set": {"status": "unpublished", "updated_at": now}},
    )
    await db[COLLECTION].update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}},
    )
