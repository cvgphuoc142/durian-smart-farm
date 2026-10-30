"""`/v1/sync` request and `/v1/snapshot` response shapes."""

from datetime import datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.entities import (
    CareLogRow,
    DiseaseCaseRow,
    ExpenseRow,
    FarmRow,
    PlotRow,
    SalePaymentRow,
    SaleRow,
    ScanRow,
    SelfCheckRow,
    SeasonRow,
)

EntityName = Literal[
    "farm",
    "plot",
    "season",
    "care_log",
    "expense",
    "sale",
    "sale_payment",
    "disease_case",
    "scan",
    "self_check",
]


class Op(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity: EntityName
    op: Literal["upsert", "delete"]
    id: UUID
    # null creates the row; otherwise the revision the client last saw. Required key.
    expected_revision: int | None = Field(..., ge=1)
    data: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _shape(self) -> Self:
        if self.op == "upsert" and self.data is None:
            raise ValueError("upsert needs data")
        if self.op == "delete" and (self.data is not None or self.expected_revision is None):
            raise ValueError("delete needs expected_revision and no data")
        return self


class Mutation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mutation_id: UUID
    ops: list[Op] = Field(..., min_length=1, max_length=50)


class SyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mutations: list[Mutation] = Field(..., min_length=1, max_length=20)


class SyncResponse(BaseModel):
    # One result per request mutation, same order: applied | conflict | rejected.
    results: list[dict[str, Any]]


class Snapshot(BaseModel):
    as_of: datetime
    farms: list[FarmRow]  # type: ignore[valid-type]
    plots: list[PlotRow]  # type: ignore[valid-type]
    seasons: list[SeasonRow]  # type: ignore[valid-type]
    care_logs: list[CareLogRow]  # type: ignore[valid-type]
    expenses: list[ExpenseRow]  # type: ignore[valid-type]
    sales: list[SaleRow]  # type: ignore[valid-type]
    sale_payments: list[SalePaymentRow]  # type: ignore[valid-type]
    disease_cases: list[DiseaseCaseRow]  # type: ignore[valid-type]
    media_assets: list[dict[str, Any]]
    scans: list[ScanRow]  # type: ignore[valid-type]
    self_checks: list[SelfCheckRow]  # type: ignore[valid-type]
