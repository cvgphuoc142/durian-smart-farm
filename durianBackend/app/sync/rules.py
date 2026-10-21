"""Per-entity business rules (the integrity Postgres gave through FKs and CHECKs).

`validate(ctx, entity_id, model, existing)` runs against the FINAL state of the row
(patch merged over the stored row) and returns server-owned fields to store.
`on_delete(ctx, row)` registers deferred checks that run after all ops of the mutation.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.db.codecs import to_decimal
from app.domain import money
from app.domain.errors import ErrorCode
from app.sync.context import TxContext

Row = dict[str, Any]
Validate = Callable[[TxContext, UUID, Any, Row | None], Awaitable[Row]]
OnDelete = Callable[[TxContext, Row], Awaitable[None]]


@dataclass(frozen=True)
class EntityRules:
    validate: Validate
    on_delete: OnDelete


async def _no_delete_rule(ctx: TxContext, row: Row) -> None:
    return None


async def _parent(ctx: TxContext, entity: str, id: UUID, field: str) -> Row:
    row = await ctx.repos[entity].get(id)
    if row is None:
        ctx.reject(ErrorCode.parent_not_found, f"data.{field}")
    return row


def _no_live_children(
    ctx: TxContext,
    row: Row,
    children: list[tuple[str, str]],
    raw: list[tuple[str, str]] | None = None,
) -> None:
    """Defer has_live_children: (entity, fk field) pairs plus not-yet-implemented collections."""
    index = ctx.op_index

    async def check() -> None:
        for entity, fk in children:
            if await ctx.repos[entity].exists_live({fk: row["id"]}):
                ctx.reject(ErrorCode.has_live_children, "id", index=index)
        for collection, fk in raw or []:
            if await ctx.repos.raw_exists_live(collection, {fk: row["id"]}):
                ctx.reject(ErrorCode.has_live_children, "id", index=index)

    ctx.defer(("children", id_key(row)), check)


def id_key(row: Row) -> str:
    return str(row["id"])


# --- farm / plot / season ------------------------------------------------------------


async def farm_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    return {}


async def farm_on_delete(ctx: TxContext, row: Row) -> None:
    _no_live_children(ctx, row, [("plot", "farm_id")])


async def plot_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "farm", m.farm_id, "farm_id")
    if await ctx.repos["plot"].exists_live(
        {"farm_id": m.farm_id, "name": m.name, "_id": {"$ne": id}}
    ):
        ctx.reject(ErrorCode.duplicate_plot_name, "data.name")
    return {}


async def plot_on_delete(ctx: TxContext, row: Row) -> None:
    _no_live_children(ctx, row, [("season", "plot_id")])


_FORECAST = ("forecast_yield_kg", "forecast_price_vnd_kg", "forecast_total_cost_vnd")


def _same_forecast(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return Decimal(a) == Decimal(b)


async def season_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "plot", m.plot_id, "plot_id")
    if m.closed_on is None and await ctx.repos["season"].exists_live(
        {"plot_id": m.plot_id, "closed_on": None, "_id": {"$ne": id}}
    ):
        ctx.reject(ErrorCode.open_season_exists, "data.plot_id")
    # Server-owned: when the forecast last changed.
    stamp: datetime | None = existing["forecast_updated_at"] if existing else None
    changed = any(
        not _same_forecast(getattr(m, f), existing[f] if existing else None) for f in _FORECAST
    )
    if changed:
        stamp = ctx.now
    return {"forecast_updated_at": stamp}


async def season_on_delete(ctx: TxContext, row: Row) -> None:
    _no_live_children(
        ctx,
        row,
        [
            ("care_log", "season_id"),
            ("expense", "season_id"),
            ("sale", "season_id"),
        ],
        raw=[("disease_cases", "season_id"), ("scans", "season_id"), ("self_checks", "season_id")],
    )


# --- care log / expense --------------------------------------------------------------


async def care_log_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "season", m.season_id, "season_id")
    if m.case_id is not None:
        case = await ctx.repos.raw_get_live("disease_cases", m.case_id)
        if case is None:
            ctx.reject(ErrorCode.parent_not_found, "data.case_id")
        if case["season_id"] != m.season_id:
            ctx.reject(ErrorCode.season_mismatch, "data.case_id")
    if m.photo_id is not None and await ctx.repos.raw_get_live("media_assets", m.photo_id) is None:
        ctx.reject(ErrorCode.parent_not_found, "data.photo_id")
    if m.kind in ("fertilizing", "spraying") and not m.inputs:
        ctx.reject(ErrorCode.care_input_required, "data.inputs")
    if existing is not None and existing["season_id"] != m.season_id:
        # Moving a care log to another season must not strand its linked expense.
        index = ctx.op_index

        async def linked_expense_follows() -> None:
            linked = await ctx.repos["expense"].find_live({"care_log_id": id})
            if any(e["season_id"] != m.season_id for e in linked):
                ctx.reject(ErrorCode.season_mismatch, "data.season_id", index=index)

        ctx.defer(("care_log_season", str(id)), linked_expense_follows)
    return {}


async def care_log_on_delete(ctx: TxContext, row: Row) -> None:
    index = ctx.op_index

    async def check() -> None:
        # A live expense left behind means it was not tombstoned in this same mutation.
        if await ctx.repos["expense"].exists_live({"care_log_id": row["id"]}):
            ctx.reject(ErrorCode.expense_must_delete_with_care_log, "id", index=index)

    ctx.defer(("care_log_delete", id_key(row)), check)


async def expense_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "season", m.season_id, "season_id")
    if m.care_log_id is not None:
        care_log = await _parent(ctx, "care_log", m.care_log_id, "care_log_id")
        if care_log["season_id"] != m.season_id:
            ctx.reject(ErrorCode.season_mismatch, "data.care_log_id")
        if await ctx.repos["expense"].exists_live(
            {"care_log_id": m.care_log_id, "_id": {"$ne": id}}
        ):
            ctx.reject(ErrorCode.expense_link_taken, "data.care_log_id")
    return {}


# --- sale / payments -----------------------------------------------------------------


async def sale_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "season", m.season_id, "season_id")
    if m.status == "confirmed" and m.total_vnd is None:
        ctx.reject(ErrorCode.confirmed_requires_total, "data.total_vnd")
    return {}


async def sale_on_delete(ctx: TxContext, row: Row) -> None:
    index = ctx.op_index

    async def check() -> None:
        if await ctx.repos["sale_payment"].exists_live({"sale_id": row["id"]}):
            ctx.reject(ErrorCode.sale_has_payments, "id", index=index)

    ctx.defer(("sale_delete", id_key(row)), check)


def _defer_refund_check(ctx: TxContext, sale_id: UUID) -> None:
    index = ctx.op_index

    async def check() -> None:
        pairs = [
            (p["kind"], to_decimal(p["amount_vnd"]))
            for p in await ctx.repos["sale_payment"].find_live({"sale_id": sale_id})
        ]
        if money.refunded(pairs) > money.received_gross(pairs):
            ctx.reject(ErrorCode.refund_exceeds_receipts, "data.amount_vnd", index=index)

    ctx.defer(("refund", str(sale_id)), check)


async def sale_payment_validate(ctx: TxContext, id: UUID, m: Any, existing: Row | None) -> Row:
    await _parent(ctx, "sale", m.sale_id, "sale_id")
    _defer_refund_check(ctx, m.sale_id)
    if existing is not None and existing["sale_id"] != m.sale_id:
        _defer_refund_check(ctx, existing["sale_id"])  # the sale it left
    return {}


async def sale_payment_on_delete(ctx: TxContext, row: Row) -> None:
    # Removing a deposit/receipt can leave a refund without cover.
    _defer_refund_check(ctx, row["sale_id"])


RULES: dict[str, EntityRules] = {
    "farm": EntityRules(farm_validate, farm_on_delete),
    "plot": EntityRules(plot_validate, plot_on_delete),
    "season": EntityRules(season_validate, season_on_delete),
    "care_log": EntityRules(care_log_validate, care_log_on_delete),
    "expense": EntityRules(expense_validate, _no_delete_rule),
    "sale": EntityRules(sale_validate, sale_on_delete),
    "sale_payment": EntityRules(sale_payment_validate, sale_payment_on_delete),
}
