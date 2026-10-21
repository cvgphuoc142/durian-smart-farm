"""Phase 3: care log + expense, sales and payments (AC-03..06, AC-09)."""

from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.domain import money
from tests.integration.helpers import Farmer, delete, rejected, setup_garden, uid, upsert

pytestmark = pytest.mark.integration

DAY = "2026-10-15"


def care(season: str, kind: str = "watering", **extra: Any) -> dict[str, Any]:
    return {"season_id": season, "occurred_on": DAY, "kind": kind, **extra}


def expense(season: str, amount: str = "100000", **extra: Any) -> dict[str, Any]:
    return {
        "season_id": season,
        "occurred_on": DAY,
        "category": "fertilizer",
        "amount_vnd": amount,
        **extra,
    }


def npk(amount: str | None = "2", unit: str | None = "kg") -> dict[str, Any]:
    return {"id": uid(), "product_name": "NPK 16-16-8", "amount": amount, "unit": unit}


# --- care log ---------------------------------------------------------------------------


def test_care_log_inputs_rules(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    rejected(
        f.one(upsert("care_log", uid(), care(s, "fertilizing"))),
        "care_input_required",
        "ops.0.data.inputs",
    )
    rejected(
        f.one(upsert("care_log", uid(), care(s, "spraying", inputs=[]))), "care_input_required"
    )
    f.ok(upsert("care_log", uid(), care(s, "watering")))  # no inputs needed
    r = f.one(upsert("care_log", uid(), care(s, "fertilizing", inputs=[npk("2", None)])))
    rejected(r, "input_amount_unit_pair", "ops.0.data.inputs.0")
    rejected(
        f.one(upsert("care_log", uid(), care(s, "fertilizing", inputs=[npk("0", "kg")]))),
        "must_be_positive",
        "ops.0.data.inputs.0.amount",
    )
    # input without amount at all is fine (product known, amount unknown)
    row = f.rows(f.ok(upsert("care_log", uid(), care(s, "spraying", inputs=[npk(None, None)]))))[0]
    assert row["inputs"][0]["amount"] is None and row["inputs"][0]["active_ingredient"] is None


def test_care_log_inputs_are_replace_all(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    cid = uid()
    first = npk("2", "kg")
    row = f.rows(
        f.ok(upsert("care_log", cid, care(s, "fertilizing", inputs=[first, npk("1.5", "l")])))
    )[0]
    assert [i["amount"] for i in row["inputs"]] == ["2.000", "1.500"]
    only = npk("3", "kg")
    row = f.rows(f.ok(upsert("care_log", cid, {"inputs": [only]}, rev=1)))[0]
    assert [i["id"] for i in row["inputs"]] == [only["id"]]
    # patch that leaves fertilizing without inputs is judged on the final state
    rejected(f.one(upsert("care_log", cid, {"inputs": []}, rev=2)), "care_input_required")
    row = f.rows(f.ok(upsert("care_log", cid, {"kind": "watering", "inputs": []}, rev=2)))[0]
    assert row["inputs"] == [] and row["kind"] == "watering"
    # a kind change alone is also judged against stored inputs
    rejected(f.one(upsert("care_log", cid, {"kind": "spraying"}, rev=3)), "care_input_required")


def test_care_log_references(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    rejected(
        f.one(upsert("care_log", uid(), care(s, case_id=uid()))),
        "parent_not_found",
        "ops.0.data.case_id",
    )
    rejected(
        f.one(upsert("care_log", uid(), care(s, photo_id=uid()))),
        "parent_not_found",
        "ops.0.data.photo_id",
    )
    rejected(
        f.one(upsert("care_log", uid(), care(uid()))), "parent_not_found", "ops.0.data.season_id"
    )
    rejected(f.one(upsert("care_log", uid(), care(s, occurred_on="2026-13-01"))), "invalid_format")


# --- expense linkage --------------------------------------------------------------------


def test_care_log_with_cost_is_one_mutation_and_edits_the_same_expense(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    cid, eid = uid(), uid()
    r = f.ok(
        upsert("care_log", cid, care(s, "fertilizing", inputs=[npk()])),
        upsert("expense", eid, expense(s, "150000.5", care_log_id=cid)),
    )
    care_row, exp_row = f.rows(r)
    assert exp_row["care_log_id"] == cid and exp_row["amount_vnd"] == "150000.50"
    # editing the amount "from the care log" sends the same expense row
    row = f.rows(f.ok(upsert("expense", eid, {"amount_vnd": "200000"}, rev=1)))[0]
    assert (row["id"], row["revision"], row["amount_vnd"]) == (eid, 2, "200000.00")
    assert len(f.snapshot()["expenses"]) == 1 and care_row["revision"] == 1


def test_expense_rules(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    rejected(
        f.one(upsert("expense", uid(), expense(s, "0"))),
        "must_be_positive",
        "ops.0.data.amount_vnd",
    )
    rejected(f.one(upsert("expense", uid(), expense(s, "12.345"))), "invalid_format")
    rejected(f.one(upsert("expense", uid(), expense(s, "-5"))), "invalid_format")
    rejected(f.one(upsert("expense", uid(), expense(s, 100000))), "invalid_format")  # JSON number
    rejected(
        f.one(upsert("expense", uid(), expense(s, care_log_id=uid()))),
        "parent_not_found",
        "ops.0.data.care_log_id",
    )
    rejected(
        f.one(upsert("expense", uid(), expense(uid()))), "parent_not_found", "ops.0.data.season_id"
    )
    rejected(f.one(upsert("expense", uid(), {**expense(s), "category": "beer"})), "invalid_format")
    # an expense without a care log is a plain book entry
    assert f.rows(f.ok(upsert("expense", uid(), expense(s, "1"))))[0]["care_log_id"] is None


def test_one_live_expense_per_care_log(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    cid, e1 = uid(), uid()
    f.ok(upsert("care_log", cid, care(s)), upsert("expense", e1, expense(s, care_log_id=cid)))
    rejected(
        f.one(upsert("expense", uid(), expense(s, care_log_id=cid))),
        "expense_link_taken",
        "ops.0.data.care_log_id",
    )
    # attaching a second, existing expense to the same care log is also taken
    e2 = uid()
    f.ok(upsert("expense", e2, expense(s)))
    rejected(f.one(upsert("expense", e2, {"care_log_id": cid}, rev=1)), "expense_link_taken")
    # tombstoning the first frees the link
    f.ok(delete("expense", e1, 1))
    f.ok(upsert("expense", e2, {"care_log_id": cid}, rev=1))


def test_expense_and_care_log_must_share_a_season(api: TestClient) -> None:
    f = Farmer(api)
    g = setup_garden(f)
    plot2, season2, cid = uid(), uid(), uid()
    f.ok(upsert("plot", plot2, {"farm_id": g["farm"], "name": "Lô B"}))
    f.ok(
        upsert(
            "season",
            season2,
            {"plot_id": plot2, "name": "Vụ B", "started_on": "2026-03-01", "stage": "recovery"},
        )
    )
    f.ok(upsert("care_log", cid, care(g["season"])))
    rejected(
        f.one(upsert("expense", uid(), expense(season2, care_log_id=cid))),
        "season_mismatch",
        "ops.0.data.care_log_id",
    )
    # moving a care log that carries an expense to another season must not strand the expense
    f.ok(upsert("expense", uid(), expense(g["season"], care_log_id=cid)))
    rejected(
        f.one(upsert("care_log", cid, {"season_id": season2}, rev=1)),
        "season_mismatch",
        "ops.0.data.season_id",
    )


def test_deleting_a_care_log_with_a_live_expense_must_delete_both(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    cid, eid = uid(), uid()
    f.ok(upsert("care_log", cid, care(s)), upsert("expense", eid, expense(s, care_log_id=cid)))
    rejected(f.one(delete("care_log", cid, 1)), "expense_must_delete_with_care_log", "ops.0.id")
    # both in one mutation, parent first
    f.ok(delete("care_log", cid, 1), delete("expense", eid, 1))
    snap = f.snapshot()
    assert all(x["deleted_at"] for x in snap["care_logs"] + snap["expenses"])
    # deleting the expense on its own is allowed, and then the care log can go alone
    c2, e2 = uid(), uid()
    f.ok(upsert("care_log", c2, care(s)), upsert("expense", e2, expense(s, care_log_id=c2)))
    f.ok(delete("expense", e2, 1))
    f.ok(delete("care_log", c2, 1))


# --- sales and payments -----------------------------------------------------------------


def sale(
    season: str, status: str = "confirmed", total: str | None = "100", **extra: Any
) -> dict[str, Any]:
    return {
        "season_id": season,
        "buyer_name": "Anh Ba",
        "agreed_on": DAY,
        "status": status,
        "total_vnd": total,
        **extra,
    }


def pay(sale_id: str, kind: str, amount: str, **extra: Any) -> dict[str, Any]:
    return {"sale_id": sale_id, "occurred_on": DAY, "kind": kind, "amount_vnd": amount, **extra}


def test_sale_rules(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    rejected(
        f.one(upsert("sale", uid(), sale(s, total=None))),
        "confirmed_requires_total",
        "ops.0.data.total_vnd",
    )
    f.ok(upsert("sale", uid(), sale(s, "provisional", None)))  # unknown total is fine, not 0
    row = f.rows(f.ok(upsert("sale", uid(), sale(s, total="0"))))[0]
    assert row["total_vnd"] == "0.00"  # a free confirmed sale is valid
    rejected(
        f.one(upsert("sale", uid(), sale(s, weight_kg="0"))),
        "must_be_positive",
        "ops.0.data.weight_kg",
    )
    assert f.rows(f.ok(upsert("sale", uid(), sale(s, weight_kg="1.5"))))[0]["weight_kg"] == "1.500"
    rejected(f.one(upsert("sale", uid(), sale(s, buyer_name=" "))), "required")
    rejected(f.one(upsert("sale", uid(), sale(s, "sold"))), "invalid_format")
    # moving a confirmed sale back to unknown total is judged on the final state
    sid = uid()
    f.ok(upsert("sale", sid, sale(s)))
    rejected(f.one(upsert("sale", sid, {"total_vnd": None}, rev=1)), "confirmed_requires_total")
    f.ok(upsert("sale", sid, {"status": "provisional", "total_vnd": None}, rev=1))


def _ledger(f: Farmer, sale_id: str) -> tuple[Decimal, Decimal, Decimal]:
    snap = f.snapshot()
    sale_row = next(x for x in snap["sales"] if x["id"] == sale_id)
    live = [
        (p["kind"], Decimal(p["amount_vnd"]))
        for p in snap["sale_payments"]
        if p["sale_id"] == sale_id and p["deleted_at"] is None
    ]
    net = money.net_receipts(live)
    total = Decimal(sale_row["total_vnd"])
    return net, money.receivable_confirmed(total, net), money.refund_due_confirmed(total, net)


def test_ac03_partial_payments_over_the_api(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    sid = uid()
    f.ok(upsert("sale", sid, sale(s, total="100.00")))
    f.ok(upsert("sale_payment", uid(), pay(sid, "deposit", "20.00")))
    assert _ledger(f, sid) == (Decimal("20"), Decimal("80"), Decimal("0"))
    f.ok(upsert("sale_payment", uid(), pay(sid, "receipt", "30.00")))
    assert _ledger(f, sid) == (Decimal("50"), Decimal("50"), Decimal("0"))
    f.ok(upsert("sale_payment", uid(), pay(sid, "receipt", "50.00")))
    assert _ledger(f, sid) == (Decimal("100"), Decimal("0"), Decimal("0"))


def test_ac04_overpayment_and_cancelled_sale(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    sid = uid()
    f.ok(upsert("sale", sid, sale(s, total="40.00")))
    f.ok(upsert("sale_payment", uid(), pay(sid, "deposit", "50.00")))
    assert _ledger(f, sid) == (Decimal("50"), Decimal("0"), Decimal("10"))
    # cancelling keeps the money record; the refund is recorded as a payment
    f.ok(upsert("sale", sid, {"status": "cancelled"}, rev=1))
    f.ok(upsert("sale_payment", uid(), pay(sid, "refund", "50.00")))
    snap = f.snapshot()
    assert [p["kind"] for p in snap["sale_payments"]] == ["deposit", "refund"]


def test_refund_cannot_exceed_deposits_and_receipts(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    sid, dep, rec = uid(), uid(), uid()
    f.ok(upsert("sale", sid, sale(s, total="100")))
    rejected(
        f.one(upsert("sale_payment", uid(), pay(sid, "refund", "1"))),
        "refund_exceeds_receipts",
        "ops.0.data.amount_vnd",
    )
    f.ok(
        upsert("sale_payment", dep, pay(sid, "deposit", "20")),
        upsert("sale_payment", rec, pay(sid, "receipt", "30")),
    )
    ref = uid()
    f.ok(upsert("sale_payment", ref, pay(sid, "refund", "50")))  # exactly the cover
    rejected(
        f.one(upsert("sale_payment", uid(), pay(sid, "refund", "0.01"))), "refund_exceeds_receipts"
    )
    # editing the refund upward, or removing cover, is judged on the final totals
    rejected(
        f.one(upsert("sale_payment", ref, {"amount_vnd": "50.01"}, rev=1)),
        "refund_exceeds_receipts",
    )
    rejected(f.one(delete("sale_payment", rec, 1)), "refund_exceeds_receipts")
    rejected(
        f.one(upsert("sale_payment", dep, {"kind": "refund"}, rev=1)), "refund_exceeds_receipts"
    )
    # deposit + refund of the same money in ONE mutation is fine regardless of op order
    s2 = uid()
    f.ok(upsert("sale", s2, sale(s, total="10")))
    f.ok(
        upsert("sale_payment", uid(), pay(s2, "refund", "5")),
        upsert("sale_payment", uid(), pay(s2, "deposit", "5")),
    )
    # removing the refund together with the cover is fine
    f.ok(delete("sale_payment", ref, 1), delete("sale_payment", rec, 1))


def test_sale_with_payments_is_not_deleted_silently(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    sid, pid = uid(), uid()
    f.ok(upsert("sale", sid, sale(s)))
    f.ok(upsert("sale_payment", pid, pay(sid, "deposit", "10")))
    rejected(f.one(delete("sale", sid, 1)), "sale_has_payments", "ops.0.id")
    f.ok(delete("sale_payment", pid, 1), delete("sale", sid, 1))  # explicit, same mutation
    assert all(x["deleted_at"] for x in f.snapshot()["sales"])
    rejected(
        f.one(upsert("sale_payment", uid(), pay(sid, "deposit", "1"))),
        "parent_not_found",
        "ops.0.data.sale_id",
    )


def test_closed_season_still_accepts_payments_for_old_debts(api: TestClient) -> None:
    f = Farmer(api)
    s = setup_garden(f)["season"]
    sid = uid()
    f.ok(upsert("sale", sid, sale(s, total="100")))
    f.ok(upsert("season", s, {"closed_on": "2026-09-30"}, rev=1))
    f.ok(upsert("sale_payment", uid(), pay(sid, "receipt", "100")))
    f.ok(upsert("sale", sid, {"note": "đã thu đủ"}, rev=1))  # corrections too


def test_payment_rules_and_isolation(api: TestClient) -> None:
    a, b = Farmer(api), Farmer(api)
    s = setup_garden(a)["season"]
    sid = uid()
    a.ok(upsert("sale", sid, sale(s)))
    rejected(a.one(upsert("sale_payment", uid(), pay(sid, "deposit", "0"))), "must_be_positive")
    rejected(a.one(upsert("sale_payment", uid(), pay(sid, "tip", "1"))), "invalid_format")
    rejected(a.one(upsert("sale_payment", uid(), pay(uid(), "deposit", "1"))), "parent_not_found")
    rejected(
        b.one(upsert("sale_payment", uid(), pay(sid, "deposit", "1"))),
        "parent_not_found",
        "ops.0.data.sale_id",
    )
    # moving a payment to another sale re-checks both sales
    s2, dep, ref = uid(), uid(), uid()
    a.ok(upsert("sale", s2, sale(s)))
    a.ok(upsert("sale_payment", dep, pay(sid, "deposit", "10")))
    a.ok(upsert("sale_payment", ref, pay(sid, "refund", "10")))
    rejected(a.one(upsert("sale_payment", dep, {"sale_id": s2}, rev=1)), "refund_exceeds_receipts")
