from typing import Annotated

from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import get_database
from app.api.errors import ApiError
from app.domain.errors import ErrorCode

router = APIRouter(tags=["ops"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, str]:
    try:
        await db.command("ping")
    except Exception as exc:
        raise ApiError(ErrorCode.service_unavailable, "database unreachable") from exc
    return {"status": "ready"}
