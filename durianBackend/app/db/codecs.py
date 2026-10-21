"""Decimal128 <-> wire string. Money is stored as Decimal128, never float."""

from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from bson.decimal128 import Decimal128

from app.domain.money import fmt, quantize


def to_d128(text: str | Decimal, scale: int) -> Decimal128:
    return Decimal128(quantize(Decimal(text), scale))


def from_d128(value: Decimal128 | Decimal | str, scale: int) -> str:
    dec = value.to_decimal() if isinstance(value, Decimal128) else Decimal(value)
    return fmt(dec, scale)


def to_decimal(value: Decimal128 | Decimal | str) -> Decimal:
    return value.to_decimal() if isinstance(value, Decimal128) else Decimal(value)


def encode_decimals(doc: dict[str, Any], scales: Mapping[str, int]) -> dict[str, Any]:
    """Wire strings -> Decimal128 for the listed top-level fields (None stays None)."""
    out = dict(doc)
    for name, scale in scales.items():
        if out.get(name) is not None:
            out[name] = to_d128(out[name], scale)
    return out


def decode_decimals(doc: dict[str, Any], scales: Mapping[str, int]) -> dict[str, Any]:
    out = dict(doc)
    for name, scale in scales.items():
        if out.get(name) is not None:
            out[name] = from_d128(out[name], scale)
    return out
