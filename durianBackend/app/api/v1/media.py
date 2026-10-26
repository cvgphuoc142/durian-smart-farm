from datetime import timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.api.deps import CurrentUser, current_user, get_database
from app.api.errors import ApiError
from app.domain.errors import ErrorCode
from app.media.storage import ObjectStore, StorageError
from app.media.wire import wire
from app.sync.receipts import utcnow_ms

router = APIRouter(prefix="/v1/media", tags=["Media"])

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]
User = Annotated[CurrentUser, Depends(current_user)]

_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class PrepareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: UUID
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(ge=1)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class CompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: UUID


def _store(request: Request) -> ObjectStore:
    return request.app.state.storage  # type: ignore[no-any-return]


async def _owned(db: Db, user: CurrentUser, asset_id: UUID) -> dict[str, Any]:
    doc = await db["media_assets"].find_one(
        {"_id": asset_id, "owner_id": user.id, "deleted_at": None}
    )
    if doc is None:
        raise ApiError(ErrorCode.not_found)
    return doc  # type: ignore[no-any-return]


@router.post("/prepare", operation_id="prepareMedia")
async def prepare(body: PrepareRequest, request: Request, user: User, db: Db) -> dict[str, Any]:
    store = _store(request)
    doc = await db["media_assets"].find_one({"_id": body.asset_id})
    if doc is not None and doc["owner_id"] != user.id:
        raise ApiError(ErrorCode.not_found)  # never reveal another owner's id
    if doc is not None and (
        doc["sha256"] != body.sha256
        or doc["size_bytes"] != body.size_bytes
        or doc["mime_type"] != body.mime_type
    ):
        raise ApiError(
            ErrorCode.validation_failed,
            "asset_id already used with different bytes",
            field="sha256",
        )
    if doc is None:
        now = utcnow_ms()
        doc = {
            "_id": body.asset_id,
            "owner_id": user.id,
            "revision": 1,
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
            "object_key": f"{user.id}/{body.asset_id}.{_EXT[body.mime_type]}",
            "mime_type": body.mime_type,
            "size_bytes": body.size_bytes,
            "sha256": body.sha256,
            "status": "pending",
        }
        try:
            await db["media_assets"].insert_one(doc)
        except DuplicateKeyError:
            # Lost a race with an identical retry (or the same sha256 under another id).
            doc = await db["media_assets"].find_one({"_id": body.asset_id, "owner_id": user.id})
            if doc is None:
                raise ApiError(
                    ErrorCode.validation_failed, "this photo was already uploaded", field="sha256"
                ) from None
    url = None
    if doc["status"] != "ready":
        try:
            url = await store.presign_put(doc["object_key"], doc["mime_type"])
        except StorageError as e:
            raise ApiError(ErrorCode.service_unavailable) from e
    return {"asset": wire(doc), "upload_url": url}


@router.post("/complete", operation_id="completeMedia")
async def complete(body: CompleteRequest, request: Request, user: User, db: Db) -> dict[str, Any]:
    doc = await _owned(db, user, body.asset_id)
    if doc["status"] == "ready":
        return wire(doc)
    try:
        info = await _store(request).stat(doc["object_key"])
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e
    if info is None:
        raise ApiError(ErrorCode.upload_incomplete, "bytes have not arrived yet")
    if info.size < doc["size_bytes"]:
        raise ApiError(ErrorCode.upload_incomplete, "upload is shorter than announced")
    if info.size != doc["size_bytes"] or info.sha256 != doc["sha256"]:
        raise ApiError(ErrorCode.hash_mismatch)
    now = utcnow_ms()
    updated = await db["media_assets"].find_one_and_update(
        {"_id": doc["_id"], "owner_id": user.id},
        {"$set": {"status": "ready", "updated_at": now}, "$inc": {"revision": 1}},
        return_document=True,
    )
    assert updated is not None
    return wire(updated)


@router.get("/{id}/access", operation_id="getMediaAccess")
async def access(id: UUID, request: Request, user: User, db: Db) -> dict[str, Any]:
    doc = await _owned(db, user, id)
    if doc["status"] != "ready":
        raise ApiError(ErrorCode.not_found)
    try:
        url = await _store(request).presign_get(doc["object_key"])
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e
    ttl = request.app.state.settings.media_url_ttl_s
    return {"url": url, "expires_at": utcnow_ms() + timedelta(seconds=ttl)}
