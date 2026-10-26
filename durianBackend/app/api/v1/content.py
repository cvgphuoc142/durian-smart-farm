"""What the phone downloads: the current release and the exact text a citation points to."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import current_user, get_database
from app.api.errors import ApiError
from app.content.workflow import SCHEMA_VERSION, article_row, cut_release
from app.domain.errors import ErrorCode
from app.sync.receipts import iso

router = APIRouter(prefix="/v1/content", tags=["Content"], dependencies=[Depends(current_user)])

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]


def _manifest(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "release_no": r["release_no"],
        "schema_version": SCHEMA_VERSION,
        "checksum": r["checksum"],
        "created_at": iso(r["created_at"]),
    }


@router.get("/manifest", operation_id="getContentManifest")
async def manifest(db: Db) -> dict[str, Any]:
    current = await db["content_releases"].find_one({"state": "current"})
    if current is None:  # nothing published yet: release 1 is the real, empty release
        current = await cut_release(db)
    return _manifest(current)


@router.get("/releases/{release_no}", operation_id="getContentRelease")
async def release(release_no: int, db: Db) -> dict[str, Any]:
    r = await db["content_releases"].find_one(
        {"release_no": release_no, "state": {"$in": ["current", "ready"]}}
    )
    if r is None or "pack" not in r:
        raise ApiError(ErrorCode.not_found)
    pack: dict[str, Any] = r["pack"]
    return _manifest(r) | pack


@router.get("/article-versions/{version_id}", operation_id="getArticleVersionText")
async def article_version_text(version_id: UUID, db: Db) -> dict[str, Any]:
    """The exact text of a version a citation points at (it may have been unpublished since)."""
    v = await db["article_versions"].find_one(
        {"_id": version_id, "status": {"$in": ["published", "unpublished"]}}
    )
    if v is None:
        raise ApiError(ErrorCode.not_found)
    return {k: (str(x) if isinstance(x, UUID) else x) for k, x in article_row(v).items()}
