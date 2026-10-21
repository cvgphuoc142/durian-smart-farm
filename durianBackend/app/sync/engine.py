"""POST /v1/sync: mutations run in array order, each in ONE transaction that also stores
its receipt. Ops inside a mutation commit together or not at all."""

import logging
from typing import Any
from uuid import UUID

from pymongo import AsyncMongoClient
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern

from app.domain.errors import ErrorCode
from app.repositories.household import Repos
from app.repositories.specs import SPECS
from app.schemas.sync import Mutation
from app.sync import receipts
from app.sync.context import MutationConflict, MutationRejected, TxContext
from app.sync.handlers import apply_op

log = logging.getLogger("durian.sync")


def _rejected(
    mutation: Mutation,
    code: ErrorCode,
    field: str | None,
    details: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "mutation_id": str(mutation.mutation_id),
        "status": "rejected",
        "code": code.value,
    }
    if field:
        result["field"] = field
    if details:
        result["details"] = details
    result["as_of"] = receipts.iso(receipts.utcnow_ms())
    return result


def _dependency_failure(mutation: Mutation, failed: set[UUID]) -> str | None:
    """Field path of the first reference to a row from an earlier mutation that was not applied."""
    for i, op in enumerate(mutation.ops):
        if op.id in failed:
            return f"ops.{i}.id"
        spec = SPECS.get(op.entity)
        if spec is None or not op.data:
            continue
        for fk in spec.parents:
            try:
                ref = UUID(str(op.data[fk])) if op.data.get(fk) else None
            except ValueError:
                continue  # malformed ids are reported by validation, not here
            if ref is not None and ref in failed:
                return f"ops.{i}.data.{fk}"
    return None


async def _replay_or_none(
    db: AsyncDatabase,  # type: ignore[type-arg]
    owner_id: UUID,
    mutation: Mutation,
    digest: str,
    session: AsyncClientSession | None = None,
) -> dict[str, Any] | None:
    receipt = await receipts.find_receipt(db, owner_id, mutation.mutation_id, session)
    if receipt is None:
        return None
    if receipt["payload_hash"] != digest:
        return _rejected(mutation, ErrorCode.mutation_id_reused, "mutation_id")
    result: dict[str, Any] = receipt["result"]
    return result  # the first answer, unchanged


async def _apply_one(
    client: AsyncMongoClient,  # type: ignore[type-arg]
    db: AsyncDatabase,  # type: ignore[type-arg]
    owner_id: UUID,
    mutation: Mutation,
    failed: set[UUID],
) -> dict[str, Any]:
    digest = receipts.payload_hash(mutation)

    async def body(session: AsyncClientSession) -> dict[str, Any]:
        # Rebuilt on every attempt: with_transaction re-runs this on transient errors, e.g.
        # when a concurrent duplicate request committed first. Looking the receipt up again
        # inside the transaction turns that retry into a replay instead of a false conflict.
        replay = await _replay_or_none(db, owner_id, mutation, digest, session)
        if replay is not None:
            return replay
        now = receipts.utcnow_ms()
        ctx = TxContext(Repos(db, owner_id, session), now)
        for i, op in enumerate(mutation.ops):
            ctx.op_index = i
            await apply_op(ctx, op)
        for check in list(ctx.deferred.values()):
            await check()
        result = {
            "mutation_id": str(mutation.mutation_id),
            "status": "applied",
            "rows": ctx.rows,
            "as_of": receipts.iso(now),
        }
        await receipts.store_receipt(
            db, session, owner_id, mutation.mutation_id, digest, result, now
        )
        return result

    # Two attempts: a concurrent duplicate request can win the receipt insert; the second
    # pass then finds its receipt and replays it.
    for _ in range(2):
        replay = await _replay_or_none(db, owner_id, mutation, digest)
        if replay is not None:
            return replay
        blocked = _dependency_failure(mutation, failed)
        if blocked is not None:
            return _rejected(mutation, ErrorCode.dependency_failed, blocked)
        try:
            async with client.start_session() as session:
                return await session.with_transaction(
                    body,
                    read_concern=ReadConcern("majority"),
                    write_concern=WriteConcern("majority"),
                )
        except MutationRejected as exc:
            return _rejected(mutation, exc.code, exc.field, exc.details)
        except MutationConflict as exc:
            return {
                "mutation_id": str(mutation.mutation_id),
                "status": "conflict",
                "rows": exc.rows,
                "as_of": receipts.iso(receipts.utcnow_ms()),
            }
        except DuplicateKeyError:
            log.info("receipt race for mutation %s, replaying", mutation.mutation_id)
    raise RuntimeError("receipt race did not settle")


async def apply_mutations(
    client: AsyncMongoClient,  # type: ignore[type-arg]
    db: AsyncDatabase,  # type: ignore[type-arg]
    owner_id: UUID,
    mutations: list[Mutation],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    failed: set[UUID] = set()
    for mutation in mutations:
        result = await _apply_one(client, db, owner_id, mutation, failed)
        results.append(result)
        if result["status"] != "applied":
            failed.update(op.id for op in mutation.ops)
    return results
