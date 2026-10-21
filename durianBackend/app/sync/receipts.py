"""Idempotency: one `mutation_receipts` row per APPLIED mutation, written in the same
transaction as its ops. Rejected and conflicting mutations wrote nothing, so they leave no
receipt: re-sending one is re-evaluated against the current state (a retry after fixing the
form may reuse the id)."""

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import TypeAdapter
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.schemas.sync import Mutation

_TS = TypeAdapter(datetime)


def utcnow_ms() -> datetime:
    """Mongo stores milliseconds; truncate up front so what we return is what we stored."""
    now = datetime.now(UTC)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def iso(ts: datetime) -> str:
    return _TS.dump_json(ts).decode().strip('"')


def payload_hash(mutation: Mutation) -> str:
    canonical = json.dumps(
        mutation.model_dump(mode="json"), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


async def find_receipt(
    db: AsyncDatabase,  # type: ignore[type-arg]
    user_id: UUID,
    mutation_id: UUID,
    session: AsyncClientSession | None = None,
) -> dict[str, Any] | None:
    return await db["mutation_receipts"].find_one(
        {"user_id": user_id, "mutation_id": mutation_id}, session=session
    )


async def store_receipt(
    db: AsyncDatabase,  # type: ignore[type-arg]
    session: AsyncClientSession,
    user_id: UUID,
    mutation_id: UUID,
    digest: str,
    result: dict[str, Any],
    now: datetime,
) -> None:
    await db["mutation_receipts"].insert_one(
        {
            "user_id": user_id,
            "mutation_id": mutation_id,
            "payload_hash": digest,
            "result": result,
            "created_at": now,
        },
        session=session,
    )
