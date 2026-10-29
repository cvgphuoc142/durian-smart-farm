"""Admin: upload a scan model, edit what the farmer reads about it, publish or withdraw it.

The file goes straight to object storage through a presigned PUT (like photos); the server then
re-reads it and compares size and sha256 before the version can be published.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_database, require_admin
from app.api.errors import ApiError
from app.content.workflow import new_id, page
from app.domain.errors import ErrorCode
from app.media.storage import ObjectStore, StorageError
from app.scan_models import registry
from app.scan_models.push import notify_model_published
from app.scan_models.schema import ModelEntryBody
from app.sync.receipts import utcnow_ms

router = APIRouter(prefix="/v1/admin/models", tags=["Admin"], dependencies=[Depends(require_admin)])

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]
Limit = Annotated[int, Query(ge=1, le=100)]

_MIME = "application/octet-stream"


class CreateModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry: ModelEntryBody
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    size_bytes: int = Field(ge=1)


class EditModel(BaseModel):
    """Only what the farmer reads or what gates the app. The scoring itself is immutable."""

    model_config = ConfigDict(extra="forbid")

    release_notes: str | None = Field(None, min_length=1)
    maturity: Literal["stable", "beta"] | None = None
    limitations: str | None = None
    min_app_version: str | None = None
    clear_limitations: bool = False
    clear_min_app_version: bool = False


class Transition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["publish", "unpublish"]


def _store(request: Request) -> ObjectStore:
    return request.app.state.storage  # type: ignore[no-any-return]


def _wire(doc: dict[str, Any]) -> dict[str, Any]:
    a = doc["artifact"]
    return {
        "id": doc["_id"],
        "status": doc["status"],
        "entry": doc["entry"],
        "artifact": {"sha256": a["sha256"], "size_bytes": a["size_bytes"], "status": a["status"]},
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
        "published_at": doc.get("published_at"),
    }


async def _one(db: Any, model_id: UUID) -> dict[str, Any]:
    doc: dict[str, Any] | None = await db[registry.COLLECTION].find_one({"_id": model_id})
    if doc is None:
        raise ApiError(ErrorCode.not_found)
    return doc


async def _upload_url(request: Request, doc: dict[str, Any]) -> str:
    try:
        return await _store(request).presign_put(doc["artifact"]["key"], _MIME)
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e


@router.get("", operation_id="adminListModels")
async def list_models(
    db: Db, limit: Limit = 25, cursor: str | None = None, plant_part: str | None = None
) -> dict[str, Any]:
    flt = {"entry.plant_part": plant_part} if plant_part else {}
    rows, nxt = await page(db, registry.COLLECTION, flt, limit, cursor)
    return {"items": [_wire(r) for r in rows], "next_cursor": nxt}


@router.post("", operation_id="adminCreateModel", status_code=201)
async def create_model(body: CreateModel, request: Request, db: Db) -> dict[str, Any]:
    """Registers a version as a draft and returns where to PUT the file."""
    vid = new_id()
    now = utcnow_ms()
    doc = {
        "_id": vid,
        "entry": body.entry.to_wire(),
        "artifact": {
            "key": registry.object_key(vid),
            "sha256": body.sha256,
            "size_bytes": body.size_bytes,
            "status": "pending",
        },
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    try:
        await db[registry.COLLECTION].insert_one(doc)
    except DuplicateKeyError:
        raise ApiError(
            ErrorCode.validation_failed, "this model_id and version already exist", field="version"
        ) from None
    return {"model": _wire(doc), "upload_url": await _upload_url(request, doc)}


@router.post("/{model_id}/upload-url", operation_id="adminModelUploadUrl")
async def upload_url(model_id: UUID, request: Request, db: Db) -> dict[str, Any]:
    doc = await _one(db, model_id)
    if doc["artifact"]["status"] == "ready":
        return {"model": _wire(doc), "upload_url": None}
    return {"model": _wire(doc), "upload_url": await _upload_url(request, doc)}


@router.post("/{model_id}/complete", operation_id="adminCompleteModelUpload")
async def complete(model_id: UUID, request: Request, db: Db) -> dict[str, Any]:
    doc = await _one(db, model_id)
    if doc["artifact"]["status"] == "ready":
        return _wire(doc)
    try:
        info = await _store(request).stat(doc["artifact"]["key"])
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e
    if info is None:
        raise ApiError(ErrorCode.upload_incomplete, "bytes have not arrived yet")
    if info.size < doc["artifact"]["size_bytes"]:
        raise ApiError(ErrorCode.upload_incomplete, "upload is shorter than announced")
    if info.size != doc["artifact"]["size_bytes"] or info.sha256 != doc["artifact"]["sha256"]:
        raise ApiError(ErrorCode.hash_mismatch)
    await db[registry.COLLECTION].update_one(
        {"_id": model_id},
        {"$set": {"artifact.status": "ready", "updated_at": utcnow_ms()}},
    )
    return _wire(await _one(db, model_id))


@router.patch("/{model_id}", operation_id="adminEditModel")
async def edit_model(model_id: UUID, body: EditModel, db: Db) -> dict[str, Any]:
    """Change the notes, the beta flag, the limits or the minimum app version of any version.
    A phone that already has the file just refreshes these; it downloads nothing."""
    doc = await _one(db, model_id)
    entry = dict(doc["entry"])
    for key in ("release_notes", "maturity", "limitations", "min_app_version"):
        value = getattr(body, key)
        if value is not None:
            entry[key] = value
    if body.clear_limitations:
        entry.pop("limitations", None)
    if body.clear_min_app_version:
        entry.pop("min_app_version", None)
    # Re-validate the whole entry so an edit cannot produce one the phone would drop.
    try:
        entry = ModelEntryBody.model_validate(entry).to_wire()
    except ValidationError as e:
        raise ApiError(ErrorCode.validation_failed, str(e.errors()[0]["msg"])) from None
    await db[registry.COLLECTION].update_one(
        {"_id": model_id}, {"$set": {"entry": entry, "updated_at": utcnow_ms()}}
    )
    return _wire(await _one(db, model_id))


@router.post("/{model_id}/transition", operation_id="adminModelTransition")
async def transition(model_id: UUID, body: Transition, request: Request, db: Db) -> dict[str, Any]:
    doc = await _one(db, model_id)
    if body.action == "publish":
        if doc["status"] == "published":
            raise ApiError(ErrorCode.invalid_transition, "Already published.")
        if doc["artifact"]["status"] != "ready":
            raise ApiError(ErrorCode.upload_incomplete, "the model file is not uploaded yet")
        await registry.publish(db, doc)
        await notify_model_published(request.app.state, await _one(db, model_id))
    else:
        if doc["status"] != "published":
            raise ApiError(ErrorCode.invalid_transition, "Only a published model can be withdrawn.")
        await db[registry.COLLECTION].update_one(
            {"_id": model_id}, {"$set": {"status": "unpublished", "updated_at": utcnow_ms()}}
        )
    return _wire(await _one(db, model_id))


@router.delete("/{model_id}", operation_id="adminDeleteModel", status_code=204)
async def delete_model(model_id: UUID, request: Request, db: Db) -> None:
    """Only a version that was never published; one a phone may hold stays for its history."""
    doc = await _one(db, model_id)
    if doc["status"] != "draft" or doc.get("published_at") is not None:
        raise ApiError(ErrorCode.published_immutable)
    try:
        await _store(request).delete(doc["artifact"]["key"])
    except StorageError as e:
        raise ApiError(ErrorCode.service_unavailable) from e
    await db[registry.COLLECTION].delete_one({"_id": model_id})
