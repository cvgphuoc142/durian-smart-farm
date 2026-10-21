from typing import Any

import pytest
from pydantic import ValidationError

from app.api.errors import pydantic_error_code
from app.domain.errors import ErrorCode
from app.schemas import entities as e
from app.schemas.sync import Mutation, Op, SyncRequest

U1 = "11111111-1111-4111-8111-111111111111"
U2 = "22222222-2222-4222-8222-222222222222"


def codes(model: type, data: dict[str, Any]) -> list[tuple[str, ErrorCode]]:
    with pytest.raises(ValidationError) as ei:
        model.model_validate(data)
    return [
        (".".join(map(str, x["loc"])), pydantic_error_code(x["type"])) for x in ei.value.errors()
    ]


def test_money_must_be_a_decimal_string_not_a_number() -> None:
    base = {"sale_id": U1, "occurred_on": "2026-10-15", "kind": "deposit"}
    assert codes(e.SalePaymentCreate, {**base, "amount_vnd": 100.5}) == [
        ("amount_vnd", ErrorCode.invalid_format)
    ]
    assert (
        codes(e.SalePaymentCreate, {**base, "amount_vnd": "100,5"})[0][1]
        == ErrorCode.invalid_format
    )
    assert (
        codes(e.SalePaymentCreate, {**base, "amount_vnd": "1.234"})[0][1]
        == ErrorCode.invalid_format
    )


def test_positive_amounts_use_must_be_positive() -> None:
    base = {"sale_id": U1, "occurred_on": "2026-10-15", "kind": "deposit"}
    assert codes(e.SalePaymentCreate, {**base, "amount_vnd": "0.00"}) == [
        ("amount_vnd", ErrorCode.must_be_positive)
    ]
    assert codes(
        e.SaleCreate,
        {
            "season_id": U1,
            "buyer_name": "A",
            "agreed_on": "2026-10-15",
            "status": "provisional",
            "weight_kg": "0",
        },
    ) == [("weight_kg", ErrorCode.must_be_positive)]


def test_non_ascii_digits_are_not_decimals() -> None:
    base = {"sale_id": U1, "occurred_on": "2026-10-15", "kind": "deposit"}
    assert (
        codes(e.SalePaymentCreate, {**base, "amount_vnd": "١٢"})[0][1] == ErrorCode.invalid_format
    )
    assert (
        codes(
            e.SeasonCreate,
            {"plot_id": U1, "name": "S", "stage": "recovery", "started_on": "٢٠٢٦-١٠-١٥"},
        )[0][1]
        == ErrorCode.invalid_format
    )


def test_zero_total_is_allowed_for_a_sale() -> None:
    sale = e.SaleCreate(
        season_id=U1, buyer_name="A", agreed_on="2026-10-15", status="confirmed", total_vnd="0.00"
    )
    assert sale.total_vnd == "0.00"


def test_dates_are_real_calendar_days() -> None:
    base = {"plot_id": U1, "name": "S1", "stage": "recovery"}
    assert (
        codes(e.SeasonCreate, {**base, "started_on": "2026-02-30"})[0][1]
        == ErrorCode.invalid_format
    )
    assert (
        codes(e.SeasonCreate, {**base, "started_on": "15/10/2026"})[0][1]
        == ErrorCode.invalid_format
    )
    assert e.SeasonCreate(**base, started_on="2026-10-15").started_on == "2026-10-15"


def test_missing_blank_and_unknown_fields() -> None:
    assert codes(e.FarmCreate, {}) == [("name", ErrorCode.required)]
    assert codes(e.FarmCreate, {"name": "   "}) == [("name", ErrorCode.required)]
    assert codes(e.FarmCreate, {"name": "F", "owner_id": U1}) == [
        ("owner_id", ErrorCode.validation_failed)
    ]  # server-owned fields are not writable


def test_plot_ranges() -> None:
    base = {"farm_id": U1, "name": "P"}
    assert codes(e.PlotCreate, {**base, "tree_count": -1})[0][1] == ErrorCode.out_of_range
    assert codes(e.PlotCreate, {**base, "planted_year": 1800})[0][1] == ErrorCode.out_of_range
    assert codes(e.PlotCreate, {**base, "area_ha": "-1"})[0][1] == ErrorCode.invalid_format
    assert codes(e.PlotCreate, {**base, "tree_count": "5"})[0][1] == ErrorCode.invalid_format


def test_care_input_amount_and_unit_travel_together() -> None:
    with pytest.raises(ValidationError) as ei:
        e.CareLogCreate(
            season_id=U1,
            occurred_on="2026-10-15",
            kind="fertilizing",
            inputs=[{"id": U2, "product_name": "NPK", "amount": "2"}],
        )
    err = ei.value.errors()[0]
    assert pydantic_error_code(err["type"]) == ErrorCode.input_amount_unit_pair
    assert err["loc"][:2] == ("inputs", 0)


def test_op_shape_rules() -> None:
    ok = {
        "entity": "farm",
        "op": "upsert",
        "id": U1,
        "expected_revision": None,
        "data": {"name": "F"},
    }
    assert Op.model_validate(ok).expected_revision is None
    with pytest.raises(ValidationError):
        Op.model_validate({**ok, "data": None})  # upsert needs data
    with pytest.raises(ValidationError):
        Op.model_validate({"entity": "farm", "op": "delete", "id": U1, "expected_revision": None})
    with pytest.raises(ValidationError):
        Op.model_validate({**ok, "expected_revision": 0})
    with pytest.raises(ValidationError):
        Op.model_validate({k: v for k, v in ok.items() if k != "expected_revision"})
    with pytest.raises(ValidationError):
        Op.model_validate({**ok, "entity": "owner"})


def test_request_limits() -> None:
    op = {"entity": "farm", "op": "delete", "id": U1, "expected_revision": 1}
    mut = {"mutation_id": U2, "ops": [op]}
    SyncRequest.model_validate({"mutations": [mut] * 20})
    with pytest.raises(ValidationError):
        SyncRequest.model_validate({"mutations": [mut] * 21})
    with pytest.raises(ValidationError):
        Mutation.model_validate({"mutation_id": U2, "ops": [op] * 51})
    with pytest.raises(ValidationError):
        Mutation.model_validate({"mutation_id": U2, "ops": []})


def test_payload_hash_ignores_key_order_but_not_content() -> None:
    from app.sync.receipts import payload_hash

    a = Mutation.model_validate(
        {
            "mutation_id": U2,
            "ops": [
                {
                    "entity": "farm",
                    "op": "upsert",
                    "id": U1,
                    "expected_revision": None,
                    "data": {"name": "F", "province": "X"},
                }
            ],
        }
    )
    b = Mutation.model_validate(
        {
            "ops": [
                {
                    "data": {"province": "X", "name": "F"},
                    "expected_revision": None,
                    "id": U1,
                    "op": "upsert",
                    "entity": "farm",
                }
            ],
            "mutation_id": U2,
        }
    )
    c = Mutation.model_validate(
        {
            "mutation_id": U2,
            "ops": [
                {
                    "entity": "farm",
                    "op": "upsert",
                    "id": U1,
                    "expected_revision": None,
                    "data": {"name": "G"},
                }
            ],
        }
    )
    assert payload_hash(a) == payload_hash(b) != payload_hash(c)
