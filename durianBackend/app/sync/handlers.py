"""Generic upsert / delete for every household entity, driven by EntitySpec + RULES."""

from typing import Any

from pydantic import BaseModel, ValidationError
from pymongo.errors import DuplicateKeyError

from app.api.errors import pydantic_error_code
from app.domain.errors import ErrorCode
from app.repositories.specs import SPECS, EntitySpec
from app.schemas.sync import Op
from app.sync.context import MutationConflict, MutationRejected, TxContext
from app.sync.rules import RULES

# Partial unique indexes (db/indexes.py) are the race-proof backstop of the app-level checks.
_INDEX_CODES = {
    "plot_name_live": (ErrorCode.duplicate_plot_name, "data.name"),
    "one_open_season_per_plot": (ErrorCode.open_season_exists, "data.plot_id"),
    "expense_care_log_live": (ErrorCode.expense_link_taken, "data.care_log_id"),
}


def to_wire(spec: EntitySpec, doc: dict[str, Any]) -> dict[str, Any]:
    return spec.row.model_validate(doc).model_dump(mode="json")


def _row(spec: EntitySpec, doc: dict[str, Any]) -> dict[str, Any]:
    return {"entity": spec.name, "row": to_wire(spec, doc)}


def _parse(ctx: TxContext, spec: EntitySpec, data: dict[str, Any]) -> BaseModel:
    try:
        return spec.create.model_validate(data)
    except ValidationError as exc:
        details = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"])
            details.append(
                {
                    "field": f"ops.{ctx.op_index}.data" + (f".{loc}" if loc else ""),
                    "code": pydantic_error_code(err["type"]).value,
                }
            )
        raise MutationRejected(ErrorCode(details[0]["code"]), details[0]["field"], details) from exc


def _reject_duplicate(ctx: TxContext, exc: DuplicateKeyError) -> None:
    text = str(exc)
    for index, (code, field) in _INDEX_CODES.items():
        if index in text:
            ctx.reject(code, field)
    ctx.reject(ErrorCode.validation_failed, "id")  # `_id` already exists (maybe not ours)


async def apply_op(ctx: TxContext, op: Op) -> None:
    spec = SPECS.get(op.entity)
    if spec is None:
        # disease_case / scan / self_check sync arrives with Phase 5.
        ctx.reject(ErrorCode.validation_failed, "entity")
    if op.op == "delete":
        await _delete(ctx, spec, op)
    else:
        await _upsert(ctx, spec, op)


async def _current_or_conflict(ctx: TxContext, spec: EntitySpec, op: Op) -> dict[str, Any]:
    """The row an update/delete targets, after the ownership and revision checks."""
    existing = await ctx.repos[spec.name].get(op.id, include_deleted=True)
    if existing is None:
        ctx.reject(ErrorCode.not_found, "id")
    if existing["deleted_at"] is not None or existing["revision"] != op.expected_revision:
        raise MutationConflict([_row(spec, existing)])
    return existing


async def _upsert(ctx: TxContext, spec: EntitySpec, op: Op) -> None:
    repo = ctx.repos[spec.name]
    rules = RULES[spec.name]
    data = op.data or {}
    now = ctx.now

    if op.expected_revision is None:
        existing = await repo.get(op.id, include_deleted=True)
        if existing is not None:
            raise MutationConflict([_row(spec, existing)])  # create over an existing row
        model = _parse(ctx, spec, data)
        extra = await rules.validate(ctx, op.id, model, None)
        doc = {
            "id": op.id,
            **model.model_dump(),
            **extra,
            "revision": 1,
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        try:
            created = await repo.insert(doc)
        except DuplicateKeyError as exc:
            _reject_duplicate(ctx, exc)
        ctx.rows.append(_row(spec, created))
        return

    existing = await _current_or_conflict(ctx, spec, op)
    if not data:
        ctx.reject(ErrorCode.validation_failed, "data")
    writable = {name: existing[name] for name in spec.create.model_fields}
    model = _parse(ctx, spec, {**writable, **data})
    extra = await rules.validate(ctx, op.id, model, existing)
    try:
        updated = await repo.update(
            op.id, existing["revision"], {**model.model_dump(), **extra}, now
        )
    except DuplicateKeyError as exc:
        _reject_duplicate(ctx, exc)
    if updated is None:  # lost a race after our read: report the winner
        current = await repo.get(op.id, include_deleted=True)
        raise MutationConflict([_row(spec, current)] if current else [])
    ctx.rows.append(_row(spec, updated))


async def _delete(ctx: TxContext, spec: EntitySpec, op: Op) -> None:
    repo = ctx.repos[spec.name]
    assert op.expected_revision is not None
    existing = await _current_or_conflict(ctx, spec, op)
    await RULES[spec.name].on_delete(ctx, existing)
    tombstone = await repo.update(op.id, existing["revision"], {"deleted_at": ctx.now}, ctx.now)
    if tombstone is None:
        current = await repo.get(op.id, include_deleted=True)
        raise MutationConflict([_row(spec, current)] if current else [])
    ctx.rows.append(_row(spec, tombstone))
