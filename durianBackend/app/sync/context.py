from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, NoReturn
from uuid import UUID

from app.domain.errors import ErrorCode
from app.repositories.household import Repos


class MutationRejected(Exception):
    """422 semantics: nothing is written. `field` is a dotted path like ops.1.data.amount_vnd."""

    def __init__(
        self,
        code: ErrorCode,
        field: str | None = None,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.field = field
        self.details = details


class MutationConflict(Exception):
    """revision_conflict: nothing is written; `rows` are the server's current rows."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows


Check = Callable[[], Awaitable[None]]


@dataclass
class TxContext:
    """State of ONE mutation while it runs inside its transaction."""

    repos: Repos
    now: datetime
    op_index: int = 0
    rows: list[dict[str, Any]] = field(default_factory=list)
    deferred: dict[tuple[Any, ...], Check] = field(default_factory=dict)

    @property
    def owner_id(self) -> UUID:
        return self.repos.owner_id

    def reject(
        self, code: ErrorCode, field_path: str | None = None, *, index: int | None = None
    ) -> NoReturn:
        """`field_path` is relative to the op, e.g. "data.farm_id" or "id"."""
        i = self.op_index if index is None else index
        raise MutationRejected(code, f"ops.{i}.{field_path}" if field_path else f"ops.{i}")

    def defer(self, key: tuple[Any, ...], check: Check) -> None:
        """Run `check` once after every op of the mutation has been applied. Rules that
        depend on the final state (children tombstoned in the same mutation, refund
        totals) must not depend on op order."""
        self.deferred[key] = check
