from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.api.errors import ApiError
from app.auth import store
from app.domain.errors import ErrorCode


def get_database(request: Request) -> AsyncDatabase:  # type: ignore[type-arg]
    return request.app.state.db  # type: ignore[no-any-return]


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller. `id` is the owner of every household row."""

    id: UUID


_bearer = HTTPBearer(auto_error=False, scheme_name="bearerAuth")


async def current_token(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if creds is None or not creds.credentials:
        raise ApiError(ErrorCode.unauthenticated)
    return creds.credentials


async def current_user(
    request: Request, token: Annotated[str, Depends(current_token)]
) -> CurrentUser:
    user = await store.user_for_token(request.app.state.db, token)
    if user is None:
        raise ApiError(ErrorCode.unauthenticated)
    return CurrentUser(user["_id"])


async def require_admin(
    request: Request, user: Annotated[CurrentUser, Depends(current_user)]
) -> CurrentUser:
    """Admin = a row in `admin_members` granted by the backend, never inferred from email."""
    if await request.app.state.db["admin_members"].find_one({"user_id": user.id}) is None:
        raise ApiError(ErrorCode.admin_required)
    return user
