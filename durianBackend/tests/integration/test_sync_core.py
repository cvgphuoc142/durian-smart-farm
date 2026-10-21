"""Phase 3: farm/plot/season, idempotency, revisions, ownership."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from tests.integration.helpers import (
    FARM,
    Farmer,
    delete,
    mutation,
    rejected,
    setup_garden,
    uid,
    upsert,
)

pytestmark = pytest.mark.integration


def test_requires_authentication(api: TestClient) -> None:
    body = {"mutations": [mutation(upsert("farm", uid(), FARM))]}
    r = api.post("/v1/sync", json=body)
    assert r.status_code == 401 and r.json()["code"] == "unauthenticated"
    assert api.get("/v1/snapshot").status_code == 401


def test_setup_flow_returns_server_rows_and_snapshot(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    snap = f.snapshot()
    assert [x["id"] for x in snap["farms"]] == [ids["farm"]]
    farm = snap["farms"][0]
    assert farm["revision"] == 1 and farm["deleted_at"] is None
    assert farm["province"] is None and farm["locality_text"] is None  # nullable = present
    assert "owner_id" not in farm
    season = snap["seasons"][0]
    assert season["closed_on"] is None and season["forecast_updated_at"] is None
    for key in ("disease_cases", "media_assets", "scans", "self_checks"):
        assert snap[key] == []
    assert snap["as_of"].endswith("Z")


def test_client_cannot_set_server_owned_fields(api: TestClient) -> None:
    f = Farmer(api)
    for field in ("owner_id", "revision", "created_at", "updated_at", "deleted_at", "id"):
        r = f.one(upsert("farm", uid(), {**FARM, field: "x"}))
        rejected(r, "validation_failed", f"ops.0.data.{field}")
    assert f.snapshot()["farms"] == []


def test_replay_after_lost_ack_returns_first_answer_without_duplicates(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    m = mutation(upsert("farm", uid(), {"name": "Another"}))
    first = f.post(m)[0]
    again = f.post(m)[0]
    assert first == again  # identical, including as_of and revisions
    assert [x["revision"] for x in f.rows(again)] == [1]
    assert len(f.snapshot()["farms"]) == 2
    assert ids["farm"]


def test_same_mutation_id_with_different_payload_is_rejected(api: TestClient) -> None:
    f = Farmer(api)
    mid = uid()
    f.one(upsert("farm", uid(), {"name": "A"}), id=mid)
    r = f.one(upsert("farm", uid(), {"name": "B"}), id=mid)
    rejected(r, "mutation_id_reused", "mutation_id")
    assert len(f.snapshot()["farms"]) == 1


def test_same_mutation_id_is_scoped_per_user(api: TestClient) -> None:
    a, b = Farmer(api), Farmer(api)
    mid = uid()
    assert a.one(upsert("farm", uid(), {"name": "A"}), id=mid)["status"] == "applied"
    assert b.one(upsert("farm", uid(), {"name": "B"}), id=mid)["status"] == "applied"


def test_concurrent_duplicate_requests_apply_once(api: TestClient) -> None:
    f = Farmer(api)
    m = mutation(upsert("farm", uid(), {"name": "Racing"}))
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda _: f.post(m)[0], range(4)))
    assert all(r == results[0] for r in results), results
    assert results[0]["status"] == "applied"
    assert len(f.snapshot()["farms"]) == 1


def test_update_bumps_revision_and_merges_patch(api: TestClient) -> None:
    f = Farmer(api)
    fid = uid()
    f.ok(upsert("farm", fid, {"name": "A", "province": "Tiền Giang"}))
    row = f.rows(f.ok(upsert("farm", fid, {"name": "B"}, rev=1)))[0]
    assert (row["revision"], row["name"], row["province"]) == (2, "B", "Tiền Giang")
    assert row["updated_at"] >= row["created_at"]
    r = f.one(upsert("farm", fid, {}, rev=2))
    rejected(r, "validation_failed", "ops.0.data")
    r = f.one(upsert("farm", fid, {"name": None}, rev=2))
    rejected(r, "invalid_format", "ops.0.data.name")


def test_two_phones_editing_one_record_second_gets_conflict(api: TestClient) -> None:
    f = Farmer(api)
    fid = uid()
    f.ok(upsert("farm", fid, {"name": "A"}))
    f.ok(upsert("farm", fid, {"name": "phone 1"}, rev=1))
    r = f.one(upsert("farm", fid, {"name": "phone 2"}, rev=1))
    assert r["status"] == "conflict"
    assert [(x["row"]["name"], x["row"]["revision"]) for x in r["rows"]] == [("phone 1", 2)]
    assert f.snapshot()["farms"][0]["name"] == "phone 1"  # nothing written


def test_independent_records_are_accepted_without_conflict(api: TestClient) -> None:
    f = Farmer(api)
    a, b = uid(), uid()
    f.ok(upsert("farm", a, {"name": "A"}))
    f.ok(upsert("farm", b, {"name": "B"}))
    f.ok(upsert("farm", a, {"name": "A2"}, rev=1))
    f.ok(upsert("farm", b, {"name": "B2"}, rev=1))


def test_create_over_an_existing_id_is_a_conflict_not_an_overwrite(api: TestClient) -> None:
    f = Farmer(api)
    fid = uid()
    f.ok(upsert("farm", fid, {"name": "A"}))
    r = f.one(upsert("farm", fid, {"name": "again"}))
    assert r["status"] == "conflict"
    assert f.snapshot()["farms"][0]["name"] == "A"


def test_delete_is_a_tombstone_and_stays_in_the_snapshot(api: TestClient) -> None:
    f = Farmer(api)
    fid = uid()
    f.ok(upsert("farm", fid, {"name": "A"}))
    row = f.rows(f.ok(delete("farm", fid, 1)))[0]
    assert row["revision"] == 2 and row["deleted_at"] is not None
    snap = f.snapshot()["farms"]
    assert [(x["id"], x["revision"]) for x in snap] == [(fid, 2)]
    # a stale phone editing the tombstone gets the tombstone back as a conflict
    r = f.one(upsert("farm", fid, {"name": "revive"}, rev=1))
    assert r["status"] == "conflict" and r["rows"][0]["row"]["deleted_at"] is not None
    # deleting again with the old revision conflicts too
    assert f.one(delete("farm", fid, 1))["status"] == "conflict"


def test_unknown_row_is_not_found(api: TestClient) -> None:
    f = Farmer(api)
    rejected(f.one(upsert("farm", uid(), {"name": "x"}, rev=1)), "not_found", "ops.0.id")
    rejected(f.one(delete("farm", uid(), 1)), "not_found", "ops.0.id")


def test_other_household_rows_are_invisible_everywhere(api: TestClient) -> None:
    a, b = Farmer(api), Farmer(api)
    ids = setup_garden(a)
    # read
    assert all(v == [] for k, v in b.snapshot().items() if k != "as_of")
    # update / delete someone else's rows: indistinguishable from missing
    rejected(b.one(upsert("farm", ids["farm"], {"name": "hijack"}, rev=1)), "not_found")
    rejected(b.one(delete("plot", ids["plot"], 1)), "not_found")
    # attach own rows under someone else's parents
    rejected(
        b.one(upsert("plot", uid(), {"farm_id": ids["farm"], "name": "P"})),
        "parent_not_found",
        "ops.0.data.farm_id",
    )
    rejected(
        b.one(
            upsert(
                "care_log",
                uid(),
                {"season_id": ids["season"], "occurred_on": "2026-10-15", "kind": "watering"},
            )
        ),
        "parent_not_found",
        "ops.0.data.season_id",
    )
    # reuse of a foreign id on create must not overwrite or reveal anything
    r = b.one(upsert("farm", ids["farm"], {"name": "mine now"}))
    rejected(r, "validation_failed", "ops.0.id")
    assert a.snapshot()["farms"][0]["name"] == "Vườn Sáu Riêng"
    assert all(v == [] for k, v in b.snapshot().items() if k != "as_of")


def test_plot_name_unique_among_live_plots_of_a_farm(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    dup = {"farm_id": ids["farm"], "name": "Lô A"}
    rejected(f.one(upsert("plot", uid(), dup)), "duplicate_plot_name", "ops.0.data.name")
    other_farm = uid()
    f.ok(upsert("farm", other_farm, {"name": "F2"}))
    f.ok(upsert("plot", uid(), {"farm_id": other_farm, "name": "Lô A"}))  # other farm: fine
    b = uid()
    f.ok(upsert("plot", b, {"farm_id": ids["farm"], "name": "Lô B"}))
    rejected(  # rename onto an existing name
        f.one(upsert("plot", b, {"name": "Lô A"}, rev=1)), "duplicate_plot_name"
    )
    # a tombstoned plot frees its name
    f.ok(delete("plot", b, 1))
    f.ok(upsert("plot", uid(), {"farm_id": ids["farm"], "name": "Lô B"}))


def test_one_open_season_per_plot(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    new = {"plot_id": ids["plot"], "name": "Vụ 2", "started_on": "2026-04-01", "stage": "recovery"}
    rejected(f.one(upsert("season", uid(), new)), "open_season_exists", "ops.0.data.plot_id")
    # close the open one and a new one is fine, in either order inside one mutation
    n = uid()
    f.ok(
        upsert("season", ids["season"], {"closed_on": "2026-09-30"}, rev=1),
        upsert("season", n, new),
    )
    # reopening the closed one while another is open is rejected
    rejected(
        f.one(upsert("season", ids["season"], {"closed_on": None}, rev=2)), "open_season_exists"
    )
    # a closed season still accepts corrections
    f.ok(upsert("season", ids["season"], {"name": "Vụ 2026 (sửa)"}, rev=2))


def test_season_forecast_timestamp_is_server_owned(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    sid = ids["season"]
    row = f.rows(
        f.ok(
            upsert(
                "season",
                sid,
                {"forecast_yield_kg": "1500", "forecast_price_vnd_kg": "50000"},
                rev=1,
            )
        )
    )[0]
    assert (row["forecast_yield_kg"], row["forecast_price_vnd_kg"]) == ("1500.000", "50000.00")
    assert row["forecast_total_cost_vnd"] is None
    stamp = row["forecast_updated_at"]
    assert stamp is not None
    # unrelated edit and an identical forecast value keep the stamp
    row = f.rows(
        f.ok(upsert("season", sid, {"stage": "harvest", "forecast_yield_kg": "1500.0"}, rev=2))
    )[0]
    assert row["forecast_updated_at"] == stamp
    row = f.rows(f.ok(upsert("season", sid, {"forecast_total_cost_vnd": "1000"}, rev=3)))[0]
    assert row["forecast_updated_at"] > stamp
    rejected(
        f.one(upsert("season", sid, {"forecast_updated_at": "2026-01-01T00:00:00Z"}, rev=4)),
        "validation_failed",
    )


def test_delete_with_live_children_is_rejected_unless_same_mutation_tombstones_them(
    api: TestClient,
) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    rejected(f.one(delete("farm", ids["farm"], 1)), "has_live_children", "ops.0.id")
    rejected(f.one(delete("plot", ids["plot"], 1)), "has_live_children")
    # children first or last: order inside the mutation does not matter
    f.ok(
        delete("farm", ids["farm"], 1),
        delete("plot", ids["plot"], 1),
        delete("season", ids["season"], 1),
    )
    snap = f.snapshot()
    assert all(x["deleted_at"] for k in ("farms", "plots", "seasons") for x in snap[k])


def test_season_with_live_records_cannot_be_deleted(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    f.ok(
        upsert(
            "expense",
            uid(),
            {
                "season_id": ids["season"],
                "occurred_on": "2026-10-15",
                "category": "labor",
                "amount_vnd": "100",
            },
        )
    )
    rejected(f.one(delete("season", ids["season"], 1)), "has_live_children")


def test_mutation_is_atomic_when_a_later_op_fails(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    ok_farm = uid()
    r = f.one(
        upsert("farm", ok_farm, {"name": "would be written"}),
        upsert("plot", uid(), {"farm_id": ids["farm"], "name": "Lô A"}),  # duplicate name
    )
    rejected(r, "duplicate_plot_name", "ops.1.data.name")
    assert ok_farm not in [x["id"] for x in f.snapshot()["farms"]]


def test_rejected_mutation_can_be_resent_with_same_id_after_fixing(api: TestClient) -> None:
    f = Farmer(api)
    mid, fid = uid(), uid()
    rejected(f.one(upsert("farm", fid, {"name": ""}), id=mid), "required", "ops.0.data.name")
    assert f.one(upsert("farm", fid, {"name": "fixed"}), id=mid)["status"] == "applied"


def test_dependency_failed_for_children_of_an_unapplied_mutation(api: TestClient) -> None:
    f = Farmer(api)
    farm, plot, lonely = uid(), uid(), uid()
    results = f.post(
        mutation(upsert("farm", farm, {"name": ""})),  # rejected
        mutation(upsert("plot", plot, {"farm_id": farm, "name": "P"})),  # depends on it
        mutation(upsert("farm", lonely, {"name": "independent"})),
        mutation(upsert("plot", uid(), {"farm_id": plot, "name": "Q"})),  # depends on dependent
    )
    assert [r["status"] for r in results] == ["rejected", "rejected", "applied", "rejected"]
    rejected(results[1], "dependency_failed", "ops.0.data.farm_id")
    rejected(results[3], "dependency_failed", "ops.0.data.farm_id")
    assert [x["id"] for x in f.snapshot()["farms"]] == [lonely]


def test_in_order_parent_then_child_in_one_request(api: TestClient) -> None:
    f = Farmer(api)
    farm, plot = uid(), uid()
    results = f.post(
        mutation(upsert("farm", farm, FARM)),
        mutation(upsert("plot", plot, {"farm_id": farm, "name": "P"})),
    )
    assert [r["status"] for r in results] == ["applied", "applied"]


def test_scan_entities_are_not_synced_until_phase_5(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    r = f.one(
        upsert(
            "disease_case", uid(), {"season_id": ids["season"], "opened_at": "2026-10-15T00:00:00Z"}
        )
    )
    rejected(r, "validation_failed", "ops.0.entity")


def test_malformed_request_is_http_422_with_error_shape(api: TestClient) -> None:
    f = Farmer(api)
    m = mutation(upsert("farm", uid(), FARM))
    r = api.post("/v1/sync", json={"mutations": [m] * 21}, headers={"x-test-user": f.user})
    body = r.json()
    assert r.status_code == 422 and body["code"] and "request_id" in body
    r = api.post("/v1/sync", json={"mutations": []}, headers={"x-test-user": f.user})
    assert r.status_code == 422


def test_storage_uses_bson_uuid_decimal128_and_owner_id(api: TestClient, replset_uri: str) -> None:
    from bson import Binary
    from bson.decimal128 import Decimal128
    from pymongo import MongoClient

    f = Farmer(api)
    ids = setup_garden(f)
    f.ok(upsert("season", ids["season"], {"forecast_total_cost_vnd": "10.5"}, rev=1))
    db_name = api.app.state.db.name
    raw = MongoClient(replset_uri, uuidRepresentation="standard")[db_name]
    try:
        season = raw["seasons"].find_one()
        assert season is not None
        assert isinstance(season["forecast_total_cost_vnd"], Decimal128)
        assert str(season["forecast_total_cost_vnd"]) == "10.50"
        assert str(season["_id"]) == ids["season"] and str(season["owner_id"]) == f.user
        assert season["deleted_at"] is None
        legacy = MongoClient(replset_uri)[db_name]["seasons"].find_one()  # default (legacy) codec
        assert (
            legacy is not None and isinstance(legacy["_id"], Binary) and legacy["_id"].subtype == 4
        )
    finally:
        raw.client.close()


def test_concurrent_creates_of_the_same_plot_name_admit_exactly_one(api: TestClient) -> None:
    f = Farmer(api)
    ids = setup_garden(f)
    muts = [
        mutation(upsert("plot", uid(), {"farm_id": ids["farm"], "name": "Racing"}))
        for _ in range(4)
    ]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda m: f.post(m)[0], muts))
    assert sorted(r["status"] for r in results) == ["applied", "rejected", "rejected", "rejected"]
    assert {r["code"] for r in results if r["status"] == "rejected"} == {"duplicate_plot_name"}
    assert len([p for p in f.snapshot()["plots"] if p["name"] == "Racing"]) == 1


def test_concurrent_edits_from_one_revision_admit_exactly_one(api: TestClient) -> None:
    f = Farmer(api)
    fid = uid()
    f.ok(upsert("farm", fid, {"name": "A"}))
    muts = [mutation(upsert("farm", fid, {"name": f"phone {i}"}, rev=1)) for i in range(4)]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda m: f.post(m)[0], muts))
    assert sorted(r["status"] for r in results) == ["applied", "conflict", "conflict", "conflict"]
    assert f.snapshot()["farms"][0]["revision"] == 2
