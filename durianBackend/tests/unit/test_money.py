"""Every `x-derivedMetrics.testVectors` entry in contract/schema.json (AC-03..06)."""

from decimal import Decimal

import pytest

from app.db.codecs import from_d128, to_d128
from app.domain import money as m

D = Decimal


def pay(*items: tuple[str, str]) -> list[tuple[str, Decimal]]:
    return [(k, D(a)) for k, a in items]


def test_ac03_deposit_then_receipts() -> None:
    total = D("100.00")
    assert m.sales_value([("confirmed", total)]) == D("100.00")

    net = m.net_receipts(pay(("deposit", "20.00")))
    assert (net, m.receivable_confirmed(total, net)) == (D("20.00"), D("80.00"))

    net = m.net_receipts(pay(("deposit", "20.00"), ("receipt", "30.00")))
    assert (net, m.receivable_confirmed(total, net)) == (D("50.00"), D("50.00"))

    net = m.net_receipts(pay(("deposit", "20.00"), ("receipt", "30.00"), ("receipt", "50.00")))
    assert (net, m.receivable_confirmed(total, net)) == (D("100.00"), D("0.00"))


def test_ac04_overpaid_confirmed_sale() -> None:
    net = D("50.00")
    assert m.receivable_confirmed(D("40.00"), net) == D("0.00")
    assert m.refund_due_confirmed(D("40.00"), net) == D("10.00")


def test_ac04_cancelled_sale_is_excluded_but_refund_is_due() -> None:
    assert m.sales_value([("cancelled", D("100.00")), ("provisional", D("5.00"))]) == D("0")
    assert m.refund_due_cancelled(D("30.00")) == D("30.00")
    assert m.refund_due_cancelled(D("-5.00")) == D("0")


def test_ac05_half_up_after_multiplication() -> None:
    # 1.005 kg x 1.00 VND/kg = 1.005 -> 1.01 (banker's rounding would give 1.00)
    assert m.round_half_up(m.parse_kg("1.005") * m.parse_vnd("1.00"), 2) == D("1.01")
    assert m.round_half_up(D("2.675"), 2) == D("2.68")
    assert m.round_half_up(D("0.004"), 2) == D("0.00")


def test_forecast_profit_and_unknown_inputs() -> None:
    assert m.forecast_profit(D("1000.000"), D("50.50"), D("20000.00")) == D("30500.00")
    assert m.forecast_profit(None, D("50.50"), D("20000.00")) is None
    assert m.forecast_profit(D("1"), D("1"), None) is None  # unknown is not 0


def test_profit_on_recorded_and_cost() -> None:
    cost = m.recorded_cost([D("10.00"), D("2.50")])
    assert m.profit_on_recorded(D("100.00"), cost) == D("87.50")


def test_refund_cover_helpers() -> None:
    p = pay(("deposit", "20.00"), ("receipt", "30.00"), ("refund", "10.00"))
    assert m.received_gross(p) == D("50.00")
    assert m.refunded(p) == D("10.00")
    assert m.net_receipts(p) == D("40.00")


@pytest.mark.parametrize("bad", ["1,5", "1\n", "-1", "1e3", "", ".5", "1.234", "١٢"])
def test_parse_vnd_rejects_non_decimal_strings(bad: str) -> None:
    with pytest.raises(ValueError):
        m.parse_vnd(bad)


def test_decimal128_roundtrip_is_exact_and_fixed_scale() -> None:
    assert from_d128(to_d128("100", 2), 2) == "100.00"
    assert from_d128(to_d128("1.005", 3), 3) == "1.005"
    assert from_d128(to_d128("0.1", 2), 2) == "0.10"
    assert from_d128(to_d128("9999999999999999.99", 2), 2) == "9999999999999999.99"
