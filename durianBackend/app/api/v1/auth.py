from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import CurrentUser, current_token, current_user, get_database
from app.api.errors import ApiError
from app.auth import store
from app.domain.errors import ErrorCode

router = APIRouter(prefix="/v1/auth", tags=["Identity"])


class AuthSessionRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [{"provider": "google", "id_token": "dev:demo:Demo Farmer"}]
        },
    )

    provider: Literal["google", "apple"]
    id_token: str = Field(..., min_length=1)


@router.post("/session", operation_id="authExchange")
async def exchange(
    body: AuthSessionRequest,
    request: Request,
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    """Swap a Google / Apple `id_token` for a session token.

    Dev only (`APP_ENV=dev`): `dev:<subject>[:<name>]` is accepted as the token; the seeded
    demo household is `dev:demo`.
    """
    ident = await request.app.state.verifier.verify(body.provider, body.id_token)
    user = await store.upsert_user(db, ident)
    token = await store.create_session(db, user["_id"], request.app.state.settings.session_ttl_days)
    return {"token": token, "user": store.user_wire(user)}


@router.post("/logout", operation_id="logout", status_code=204)
async def logout(
    token: Annotated[str, Depends(current_token)],
    _user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> None:
    """Revoke the calling session (addition to the contract)."""
    await store.revoke_session(db, token)


class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


@router.post("/admin-login", operation_id="adminLogin")
async def admin_login(
    body: AdminLoginRequest,
    request: Request,
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    """Username + password sign-in for admin accounts (addition to the contract).

    Returns the same `{token, user}` as `/v1/auth/session`; admin routes still require an
    `admin_members` row.
    """
    user = await store.user_for_credentials(db, body.username, body.password)
    if user is None:
        raise ApiError(ErrorCode.unauthenticated)
    token = await store.create_session(db, user["_id"], request.app.state.settings.session_ttl_days)
    return {"token": token, "user": store.user_wire(user)}
