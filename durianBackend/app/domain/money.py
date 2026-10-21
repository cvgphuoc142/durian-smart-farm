"""Decimal rules shared with the phone. No floats anywhere.

Money rounds half-up to 0.01 after each multiplication; kg keep 3 decimals. An unknown
input (None) gives an unknown result (None), never 0. Derived metrics are computed here,
never stored.
"""

import re
from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

ZERO = Decimal("0")
VND_SCALE = 2
KG_SCALE = 3

_VND_RE = re.compile(r"^[0-9]{1,16}(\.[0-9]{1,2})?$")
_KG_RE = re.compile(r"^[0-9]{1,9}(\.[0-9]{1,3})?$")


def quantize(value: Decimal, places: int) -> Decimal:
    return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def round_half_up(value: Decimal, places: int = VND_SCALE) -> Decimal:
    return quantize(value, places)


def parse_decimal(text: str, pattern: re.Pattern[str]) -> Decimal:
    if not isinstance(text, str) or not pattern.fullmatch(text):
        raise ValueError(f"not a decimal string: {text!r}")
    try:
        return Decimal(text)
    except InvalidOperation as exc:  # pragma: no cover - the pattern already rules this out
        raise ValueError(text) from exc


def parse_vnd(text: str) -> Decimal:
    return quantize(parse_decimal(text, _VND_RE), VND_SCALE)


def parse_kg(text: str) -> Decimal:
    return quantize(parse_decimal(text, _KG_RE), KG_SCALE)


def fmt(value: Decimal, places: int) -> str:
    """Wire form: a fixed-scale decimal string (never exponent notation)."""
    return format(quantize(value, places), "f")


def fmt_vnd(value: Decimal) -> str:
    return fmt(value, VND_SCALE)


def fmt_kg(value: Decimal) -> str:
    return fmt(value, KG_SCALE)


# --- derived metrics -----------------------------------------------------------------


def net_receipts(payments: Iterable[tuple[str, Decimal]]) -> Decimal:
    """Per sale: deposits + receipts - refunds over live payments. Pairs are (kind, amount)."""
    total = ZERO
    for kind, amount in payments:
        total += -amount if kind == "refund" else amount
    return total


def received_gross(payments: Iterable[tuple[str, Decimal]]) -> Decimal:
    """deposit + receipt only (the ceiling a refund may not exceed)."""
    return sum((a for k, a in payments if k != "refund"), ZERO)


def refunded(payments: Iterable[tuple[str, Decimal]]) -> Decimal:
    return sum((a for k, a in payments if k == "refund"), ZERO)


def receivable_confirmed(total_vnd: Decimal, net: Decimal) -> Decimal:
    return max(total_vnd - net, ZERO)


def refund_due_confirmed(total_vnd: Decimal, net: Decimal) -> Decimal:
    return max(net - total_vnd, ZERO)


def refund_due_cancelled(net: Decimal) -> Decimal:
    return max(net, ZERO)


def sales_value(sales: Iterable[tuple[str, Decimal | None]]) -> Decimal:
    """Only CONFIRMED sales with a total count. Pairs are (status, total_vnd)."""
    return sum((t for s, t in sales if s == "confirmed" and t is not None), ZERO)


def recorded_cost(amounts: Iterable[Decimal]) -> Decimal:
    return sum(amounts, ZERO)


def profit_on_recorded(sales_total: Decimal, cost: Decimal) -> Decimal:
    return sales_total - cost


def forecast_profit(
    yield_kg: Decimal | None, price_vnd_kg: Decimal | None, total_cost_vnd: Decimal | None
) -> Decimal | None:
    if yield_kg is None or price_vnd_kg is None or total_cost_vnd is None:
        return None
    return round_half_up(yield_kg * price_vnd_kg, VND_SCALE) - total_cost_vnd
