"""Phase 5: disease cases, scans and their media reference."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.integration.helpers import Farmer, delete, rejected, setup_garden, uid, upsert

pytestmark = pytest.mark.integration

SHA = "a" * 64


def photo(f: Farmer, sha: str = SHA) -> str:
    asset = uid()
    r = f.client.post(
        "/v1/media/prepare",
        json={"asset_id": asset, "mime_type": "image/jpeg", "size_bytes": 10, "sha256": sha},
        headers={"x-test-user": f.user},
    )
    assert r.status_code == 200, r.text
    return asset


def case(season: str, **extra: Any) -> dict[str, Any]:
    return {"season_id": season, "opened_at": "2026-10-20T03:00:00.000Z", **extra}


def scan(season: str, photo_id: str, **extra: Any) -> dict[str, Any]:
    return {
        "season_id": season,
        "photo_id": photo_id,
        "captured_at": "2026-10-20T03:00:01.000Z",
        "plant_part": "leaf",
        "outcome": "suspected",
        "disease_code": "leaf__sooty_mold",
        "score": 0.91,
        "label_snapshot": "Sooty mold",
        "label_locale": "en",
        "predictions": [{"disease_code": "leaf__sooty_mold", "score": 0.91}],
        "inference_metadata": {
            "model_id": "durianos_leaf",
            "model_version": "1",
            "pipeline_version": "p1",
            "threshold_version": "t1",
            "inference_ms": 120,
            "extra_key": "kept",
        },
        **extra,
    }


def test_case_and_scan_in_one_mutation_and_snapshot(api: TestClient) -> None:
    f = Farmer(api)
    g = setup_garden(f)
    p, c, s = photo(f), uid(), uid()
    res = f.ok(
        upsert("disease_case", c, case(g["season"])),
        upsert("scan", s, scan(g["season"], p, case_id=c)),
    )
    rows = f.rows(res)
    assert rows[1]["case_id"] == c and rows[1]["revision"] == 1
    assert rows[1]["inference_metadata"]["extra_key"] == "kept"
    snap = f.snapshot()
    assert [x["id"] for x in snap["scans"]] == [s]
    assert [x["id"] for x in snap["disease_cases"]] == [c]
    assert [x["id"] for x in snap["media_assets"]] == [p]


def test_scan_rejections(api: TestClient) -> None:
    f = Farmer(api)
    g = setup_garden(f)
    p = photo(f)
    rejected(
        f.one(upsert("scan", uid(), scan(g["season"], uid()))),
        "media_not_found",
        "ops.0.data.photo_id",
    )
    # Another owner's photo is the same as a missing one.
    other = photo(Farmer(api), sha="b" * 64)
    rejected(f.one(upsert("scan", uid(), scan(g["season"], other))), "media_not_found")
    rejected(
        f.one(upsert("scan", uid(), scan(g["season"], p, plant_part=" "))), "unsupported_plant_part"
    )
    rejected(
        f.one(upsert("scan", uid(), scan(g["season"], p, disease_code=""))), "unknown_disease_code"
    )
    rejected(f.one(upsert("scan", uid(), scan(g["season"], p, case_id=uid()))), "parent_not_found")
    rejected(
        f.one(upsert("scan", uid(), scan(uid(), p))), "parent_not_found", "ops.0.data.season_id"
    )
    rejected(f.one(upsert("scan", uid(), scan(g["season"], p, outcome="error"))), "invalid_format")


def test_scan_is_immutable_except_case(api: TestClient) -> None:
    f = Farmer(api)
    g = setup_garden(f)
    p, c, s = photo(f), uid(), uid()
    f.ok(upsert("disease_case", c, case(g["season"])), upsert("scan", s, scan(g["season"], p)))
    attached = f.ok(upsert("scan", s, {"case_id": c}, 1))
    assert f.rows(attached)[0]["case_id"] == c
    rejected(f.one(upsert("scan", s, {"outcome": "healthy"}, 2)), "scan_immutable")
    detached = f.ok(upsert("scan", s, {"case_id": None}, 2))
    assert f.rows(detached)[0]["case_id"] is None


def test_case_season_mismatch_and_delete_rules(api: TestClient) -> None:
    f = Farmer(api)
    g = setup_garden(f)
    p, c, s = photo(f), uid(), uid()
    f.ok(
        upsert("disease_case", c, case(g["season"])),
        upsert("scan", s, scan(g["season"], p, case_id=c)),
    )
    rejected(f.one(delete("disease_case", c, 1)), "has_live_children")
    f.ok(delete("scan", s, 1), delete("disease_case", c, 1))
