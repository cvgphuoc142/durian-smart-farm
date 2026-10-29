"""What the phone downloads to scan: the model manifest and the (private) model files."""

from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import current_user, get_database
from app.api.errors import ApiError
from app.domain.errors import ErrorCode
from app.media.storage import StorageError
from app.scan_models.registry import COLLECTION, artifact_wire, build_manifest
from app.sync.receipts import utcnow_ms

router = APIRouter(prefix="/v1/models", tags=["Models"], dependencies=[Depends(current_user)])

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]


@router.get("/manifest", operation_id="getModelManifest")
async def manifest(db: Db) -> dict[str, Any]:
    """The published model of every body part. An empty `entries` is the honest "none yet"."""
    return await build_manifest(db)


@router.get("/{model_id}/{version}/download", operation_id="getModelDownload")
async def download(model_id: str, version: str, request: Request, db: Db) -> dict[str, Any]:
    """A short-lived link to the file of a published version. The phone checks `sha256`."""
    doc = await db[COLLECTION].find_one(
        {
            "entry.model_id": model_id,
            "entry.version": version,
            "status": "published",
            "artifact.status": "ready",
        }
    )
    if doc is None:
        raise ApiError(ErrorCode.not_found)
    ttl = request.app.state.settings.model_url_ttl_s
    try:
        url = await request.app.state.storage.presign_get(doc["artifact"]["key"], ttl)
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e
    return {
        "url": url,
        "expires_at": utcnow_ms() + timedelta(seconds=ttl),
        "sha256": doc["artifact"]["sha256"],
        "size_bytes": doc["artifact"]["size_bytes"],
        "path": artifact_wire(doc)["path"],
    }
