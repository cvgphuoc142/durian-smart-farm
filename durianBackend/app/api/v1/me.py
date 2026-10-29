from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import CurrentUser, current_user, get_database, require_admin
from app.auth import store
from app.sync.receipts import utcnow_ms

router = APIRouter(tags=["Identity"])

# Every collection holding a user's rows, with the field that points at the owner.
_OWNED = {
    "farms": "owner_id",
    "plots": "owner_id",
    "seasons": "owner_id",
    "care_logs": "owner_id",
    "expenses": "owner_id",
    "sales": "owner_id",
    "sale_payments": "owner_id",
    "disease_cases": "owner_id",
    "scans": "owner_id",
    "self_checks": "owner_id",
    "mutation_receipts": "user_id",
    "chat_reports": "user_id",
    "push_tokens": "user_id",
    "sessions": "user_id",
    "admin_members": "user_id",
    "admin_credentials": "user_id",
}


class LocaleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    locale: Literal["vi", "en"]


class AiConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int | None = Field(..., ge=1, description="null withdraws consent")


async def _user(db: AsyncDatabase, user: CurrentUser) -> dict[str, Any]:  # type: ignore[type-arg]
    doc: dict[str, Any] | None = await db["users"].find_one({"_id": user.id})
    assert doc is not None  # a live session implies a user row
    return doc


@router.get("/v1/me", operation_id="getMe")
async def get_me(
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    doc = await _user(db, user)
    return {"user": store.user_wire(doc), "preferences": store.preferences_wire(doc)}


@router.put("/v1/me/locale", operation_id="setLocale")
async def set_locale(
    body: LocaleRequest,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    await db["users"].update_one({"_id": user.id}, {"$set": {"locale": body.locale}})
    return store.preferences_wire(await _user(db, user))


@router.put("/v1/me/ai-consent", operation_id="setAiConsent")
async def set_ai_consent(
    body: AiConsentRequest,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    at = utcnow_ms() if body.version is not None else None
    await db["users"].update_one(
        {"_id": user.id}, {"$set": {"ai_consent_version": body.version, "ai_consented_at": at}}
    )
    return store.preferences_wire(await _user(db, user))


class PushTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=200)
    platform: Literal["ios", "android"]


@router.put("/v1/me/push-token", operation_id="setPushToken")
async def set_push_token(
    body: PushTokenRequest,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    """Where to tell this phone that a new scan model is out. One phone token, one owner."""
    await db["push_tokens"].update_one(
        {"_id": body.token},
        {"$set": {"user_id": user.id, "platform": body.platform, "updated_at": utcnow_ms()}},
        upsert=True,
    )
    return {"status": "registered"}


@router.delete("/v1/me/push-token", operation_id="deletePushToken")
async def delete_push_token(
    token: str,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    await db["push_tokens"].delete_one({"_id": token, "user_id": user.id})
    return {"status": "removed"}


@router.delete("/v1/me", operation_id="deleteAccount")
async def delete_account(
    request: Request,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    """Revoke every session and erase the user's rows in one transaction. Photo bytes are
    removed afterwards from a `deletion_jobs` entry; `media_pending` counts them."""
    pending = 0

    async def body(session: Any) -> None:
        nonlocal pending
        media = await db["media_assets"].find({"owner_id": user.id}, session=session).to_list()
        pending = len(media)
        if media:
            await db["deletion_jobs"].insert_one(
                {
                    "user_id": user.id,
                    "assets": [m.get("storage_key", m["_id"]) for m in media],
                    "created_at": utcnow_ms(),
                },
                session=session,
            )
            await db["media_assets"].delete_many({"owner_id": user.id}, session=session)
        for coll, owner in _OWNED.items():
            await db[coll].delete_many({owner: user.id}, session=session)
        await db["users"].delete_one({"_id": user.id}, session=session)

    async with request.app.state.client.start_session() as session:
        await session.with_transaction(body)
    return {"status": "deleted", "session_revoked": True, "media_pending": pending}


admin_router = APIRouter(prefix="/v1/admin", tags=["Admin"])


@admin_router.get("/me", operation_id="adminMe")
async def admin_me(
    user: Annotated[CurrentUser, Depends(require_admin)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    return {"user": store.user_wire(await _user(db, user)), "is_admin": True}
