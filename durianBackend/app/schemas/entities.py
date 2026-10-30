"""Household entity shapes.

`*Create` models describe the writable fields. A patch is validated by merging it over the
stored row and re-validating the whole thing through the same model, so every rule runs
against the final state. `Row` models (read shape, server-owned bookkeeping included) are
derived from the create models so the two cannot drift.
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    create_model,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

from app.schemas.types import (
    CareKind,
    DateString,
    ExpenseCategory,
    Hectares,
    Kg,
    KgPositive,
    OptText,
    PaymentKind,
    QuantityPositive,
    SaleStatus,
    Score,
    SeasonStage,
    Text,
    Vnd,
    VndPositive,
)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FarmCreate(_Strict):
    name: Text
    province: OptText = None
    locality_text: OptText = None


class PlotCreate(_Strict):
    farm_id: UUID
    name: Text
    variety: OptText = None
    area_ha: Hectares | None = None
    tree_count: StrictInt | None = Field(default=None, ge=0)
    planted_year: StrictInt | None = Field(default=None, ge=1900, le=2100)


class SeasonCreate(_Strict):
    plot_id: UUID
    name: Text
    started_on: DateString
    stage: SeasonStage
    # Free text the farmer types when stage == "other"; null for every other stage.
    stage_other: OptText = None
    expected_harvest_on: DateString | None = None
    closed_on: DateString | None = None
    forecast_yield_kg: Kg | None = None
    forecast_price_vnd_kg: Vnd | None = None
    forecast_total_cost_vnd: Vnd | None = None

    @model_validator(mode="after")
    def _stage_other_pair(self) -> "SeasonCreate":
        if (self.stage == "other") != (self.stage_other is not None):
            raise PydanticCustomError(
                "stage_other_pair", "stage_other is required for, and only for, stage 'other'"
            )
        return self


class CareInputWrite(_Strict):
    id: UUID
    product_name: Text
    amount: QuantityPositive | None = None
    unit: Text | None = None
    active_ingredient: str | None = None

    @model_validator(mode="after")
    def _amount_unit_pair(self) -> "CareInputWrite":
        if (self.amount is None) != (self.unit is None):
            raise PydanticCustomError(
                "input_amount_unit_pair", "amount and unit must be set together"
            )
        return self


class CareLogCreate(_Strict):
    season_id: UUID
    case_id: UUID | None = None
    photo_id: UUID | None = None
    occurred_on: DateString
    kind: CareKind
    note: str | None = None
    inputs: list[CareInputWrite] = Field(default_factory=list)


class ExpenseCreate(_Strict):
    season_id: UUID
    care_log_id: UUID | None = None
    occurred_on: DateString
    category: ExpenseCategory
    amount_vnd: VndPositive
    note: str | None = None


class SaleCreate(_Strict):
    season_id: UUID
    buyer_name: Text
    agreed_on: DateString
    status: SaleStatus
    total_vnd: Vnd | None = None
    weight_kg: KgPositive | None = None
    note: str | None = None


class SalePaymentCreate(_Strict):
    sale_id: UUID
    occurred_on: DateString
    kind: PaymentKind
    amount_vnd: VndPositive
    note: str | None = None


class DiseaseCaseCreate(_Strict):
    season_id: UUID
    opened_at: datetime
    closed_at: datetime | None = None
    location_note: str | None = None
    note: str | None = None


class SelfCheckAnswerWrite(_Strict):
    standard_item_id: UUID
    checked: bool
    checked_at: datetime | None = None


class SelfCheckCreate(_Strict):
    season_id: UUID
    standard_version_id: UUID
    answers: list[SelfCheckAnswerWrite]


class PredictionWrite(_Strict):
    disease_code: str | None
    score: Score


class InferenceMetadata(BaseModel):
    """Entries of the bundled manifest that produced the result; extra keys are kept."""

    model_config = ConfigDict(extra="allow")

    model_id: Text
    model_version: Text
    pipeline_version: Text
    threshold_version: Text
    inference_ms: StrictInt = Field(ge=0)


class ScanCreate(_Strict):
    season_id: UUID
    case_id: UUID | None = None
    photo_id: UUID
    captured_at: datetime
    plant_part: str
    outcome: Literal["suspected", "healthy", "inconclusive"]
    disease_code: str | None = None
    score: Score | None = None
    label_snapshot: str | None = None
    label_locale: str | None = None
    predictions: list[PredictionWrite]
    inference_metadata: InferenceMetadata

    @field_validator("plant_part")
    @classmethod
    def _plant_part(cls, value: str) -> str:
        # The server cannot see the app's model manifest; it only checks for a code.
        if not value.strip():
            raise PydanticCustomError("unsupported_plant_part", "plant_part is empty")
        return value

    @field_validator("disease_code")
    @classmethod
    def _disease_code(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise PydanticCustomError("unknown_disease_code", "disease_code is empty")
        return value


# --- read shapes -----------------------------------------------------------------------


class CareInputRow(_Strict):
    id: UUID
    product_name: str
    amount: str | None
    unit: str | None
    active_ingredient: str | None


_BOOKKEEPING: dict[str, Any] = {
    "id": (UUID, ...),
    "revision": (int, ...),
    "created_at": (datetime, ...),
    "updated_at": (datetime, ...),
    "deleted_at": (datetime | None, ...),
}


def _row(name: str, create: type[BaseModel], **extra: Any) -> type[BaseModel]:
    fields: dict[str, Any] = dict(_BOOKKEEPING)
    for fname, info in create.model_fields.items():
        # Read shape: every field present; nullable ones are null, not absent.
        fields[fname] = (info.annotation, ...)
    fields.update(extra)
    return create_model(name, __config__=ConfigDict(extra="forbid"), **fields)


FarmRow = _row("Farm", FarmCreate)
PlotRow = _row("Plot", PlotCreate)
SeasonRow = _row("Season", SeasonCreate, forecast_updated_at=(datetime | None, ...))
CareLogRow = _row("CareLog", CareLogCreate, inputs=(list[CareInputRow], ...))
ExpenseRow = _row("Expense", ExpenseCreate)
SaleRow = _row("Sale", SaleCreate)
SalePaymentRow = _row("SalePayment", SalePaymentCreate)
DiseaseCaseRow = _row("DiseaseCase", DiseaseCaseCreate)
ScanRow = _row("Scan", ScanCreate)
SelfCheckRow = _row("SelfCheck", SelfCheckCreate)
