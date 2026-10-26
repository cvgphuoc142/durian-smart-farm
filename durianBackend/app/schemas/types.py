"""Wire scalar types. Money, kg and hectares are decimal STRINGS.

Positive-amount patterns can't use a negative lookahead the pydantic regex engine does
not support, so the pattern checks the shape and an AfterValidator checks the sign (which
also yields the catalog code `must_be_positive` instead of a generic format error).
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, StringConstraints
from pydantic_core import PydanticCustomError

Text = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
OptText = Text | None

# Normalised 0-1 confidence.
Score = Annotated[float, Field(ge=0, le=1)]

Vnd = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,16}(\.[0-9]{1,2})?$")]
Kg = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,9}(\.[0-9]{1,3})?$")]
Hectares = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,8}(\.[0-9]{1,4})?$")]
Quantity = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,9}(\.[0-9]{1,3})?$")]


def _positive(value: str) -> str:
    if Decimal(value) <= 0:
        raise PydanticCustomError("must_be_positive", "must be greater than 0")
    return value


VndPositive = Annotated[Vnd, AfterValidator(_positive)]
KgPositive = Annotated[Kg, AfterValidator(_positive)]
QuantityPositive = Annotated[Quantity, AfterValidator(_positive)]


def _day(value: str) -> str:
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise PydanticCustomError("date_parsing", "not a calendar date") from exc
    return value


# YYYY-MM-DD, kept as the string the farmer typed (no timezone arithmetic).
DateString = Annotated[
    str, StringConstraints(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"), AfterValidator(_day)
]

SeasonStage = Literal[
    "recovery", "flower_induction", "flowering_fruit_set", "fruit_growth", "harvest", "other"
]
CareKind = Literal[
    "watering", "fertilizing", "spraying", "pruning", "inspection", "treatment", "other"
]
ExpenseCategory = Literal[
    "fertilizer", "plant_protection", "labor", "utilities_irrigation", "harvest_transport", "other"
]
SaleStatus = Literal["provisional", "confirmed", "cancelled"]
PaymentKind = Literal["deposit", "receipt", "refund"]
