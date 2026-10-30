"""One EntitySpec per household entity: wire name, collection, shapes, decimal fields."""

from collections.abc import Mapping
from dataclasses import dataclass, field

from pydantic import BaseModel

from app.domain.money import KG_SCALE, VND_SCALE
from app.schemas import entities as e


@dataclass(frozen=True)
class EntitySpec:
    name: str
    collection: str
    create: type[BaseModel]
    row: type[BaseModel]
    # Top-level fields stored as Decimal128 -> decimal places on the wire.
    scales: Mapping[str, int] = field(default_factory=dict)
    # Embedded lists whose items hold Decimal128 fields: list name -> {field: places}.
    nested_scales: Mapping[str, Mapping[str, int]] = field(default_factory=dict)
    # Fields holding another entity's id (used to detect dependency_failed).
    parents: tuple[str, ...] = ()


FARM = EntitySpec("farm", "farms", e.FarmCreate, e.FarmRow)
PLOT = EntitySpec(
    "plot", "plots", e.PlotCreate, e.PlotRow, scales={"area_ha": 4}, parents=("farm_id",)
)
SEASON = EntitySpec(
    "season",
    "seasons",
    e.SeasonCreate,
    e.SeasonRow,
    scales={
        "forecast_yield_kg": KG_SCALE,
        "forecast_price_vnd_kg": VND_SCALE,
        "forecast_total_cost_vnd": VND_SCALE,
    },
    parents=("plot_id",),
)
CARE_LOG = EntitySpec(
    "care_log",
    "care_logs",
    e.CareLogCreate,
    e.CareLogRow,
    nested_scales={"inputs": {"amount": 3}},
    parents=("season_id", "case_id", "photo_id"),
)
EXPENSE = EntitySpec(
    "expense",
    "expenses",
    e.ExpenseCreate,
    e.ExpenseRow,
    scales={"amount_vnd": VND_SCALE},
    parents=("season_id", "care_log_id"),
)
SALE = EntitySpec(
    "sale",
    "sales",
    e.SaleCreate,
    e.SaleRow,
    scales={"total_vnd": VND_SCALE, "weight_kg": KG_SCALE},
    parents=("season_id",),
)
SALE_PAYMENT = EntitySpec(
    "sale_payment",
    "sale_payments",
    e.SalePaymentCreate,
    e.SalePaymentRow,
    scales={"amount_vnd": VND_SCALE},
    parents=("sale_id",),
)
DISEASE_CASE = EntitySpec(
    "disease_case",
    "disease_cases",
    e.DiseaseCaseCreate,
    e.DiseaseCaseRow,
    parents=("season_id",),
)
SCAN = EntitySpec(
    "scan",
    "scans",
    e.ScanCreate,
    e.ScanRow,
    parents=("season_id", "case_id", "photo_id"),
)
SELF_CHECK = EntitySpec(
    "self_check",
    "self_checks",
    e.SelfCheckCreate,
    e.SelfCheckRow,
    parents=("season_id",),
)

SPECS: dict[str, EntitySpec] = {
    s.name: s
    for s in (FARM, PLOT, SEASON, CARE_LOG, EXPENSE, SALE, SALE_PAYMENT, DISEASE_CASE, SCAN, SELF_CHECK)
}
