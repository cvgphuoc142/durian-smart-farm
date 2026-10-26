"""Wire shape of a media_assets document."""

from typing import Any


def wire(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "revision": doc["revision"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
        "deleted_at": doc["deleted_at"],
        "object_key": doc["object_key"],
        "mime_type": doc["mime_type"],
        "size_bytes": doc["size_bytes"],
        "sha256": doc["sha256"],
        "status": doc["status"],
    }
