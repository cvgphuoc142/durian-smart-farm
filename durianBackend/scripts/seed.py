"""Seed a demo household through the real sync engine (rules + receipts apply).

    uv run python -m scripts.seed            # idempotent: re-running changes nothing
    uv run python -m scripts.seed --reset    # wipe the demo user's data first

Admin account: admin / 123456 via POST /v1/auth/admin-login.
Demo user 11111111-1111-4111-8111-111111111111 (also an admin). Sign in with
POST /v1/auth/session {"provider":"google","id_token":"dev:demo"} when APP_ENV=dev.
"""

import argparse
import asyncio
import uuid
from typing import Any

from app.auth.store import hash_password
from app.config import get_settings
from app.db.client import get_db, make_client
from app.db.indexes import ensure_indexes
from app.schemas.sync import Mutation
from app.sync.engine import apply_mutations
from app.sync.receipts import utcnow_ms

DEMO_USER = uuid.UUID("11111111-1111-4111-8111-111111111111")
_NS = uuid.UUID("00000000-0000-4000-8000-00000000d0d0")


def sid(name: str) -> str:
    """Deterministic id so re-seeding hits the receipts instead of duplicating rows."""
    return str(uuid.uuid5(_NS, name))


def up(entity: str, name: str, data: dict[str, Any], rev: int | None = None) -> dict[str, Any]:
    return {
        "entity": entity,
        "op": "upsert",
        "id": sid(name),
        "expected_revision": rev,
        "data": data,
    }


def rm(entity: str, name: str, rev: int) -> dict[str, Any]:
    return {"entity": entity, "op": "delete", "id": sid(name), "expected_revision": rev}


def mut(name: str, *ops: dict[str, Any]) -> dict[str, Any]:
    return {"mutation_id": sid(f"mut:{name}"), "ops": list(ops)}


MUTATIONS: list[dict[str, Any]] = [
    mut(
        "farm",
        up(
            "farm",
            "farm",
            {
                "name": "Vườn Sáu Riêng Cai Lậy",
                "province": "Tiền Giang",
                "locality_text": "Xã Long Khánh",
            },
        ),
    ),
    mut(
        "plots",
        up(
            "plot",
            "plot-a",
            {
                "farm_id": sid("farm"),
                "name": "Lô A",
                "variety": "Ri6",
                "area_ha": "1.5",
                "tree_count": 150,
                "planted_year": 2018,
            },
        ),
        up(
            "plot",
            "plot-b",
            {
                "farm_id": sid("farm"),
                "name": "Lô B",
                "variety": "Monthong",
                "area_ha": "0.8",
                "tree_count": 80,
                "planted_year": 2020,
            },
        ),
        up("plot", "plot-old", {"farm_id": sid("farm"), "name": "Lô cũ (sẽ xoá)"}),
    ),
    mut(
        "seasons",
        # closed season of last year + an open one on plot A; plot B has an open season.
        up(
            "season",
            "season-a-2025",
            {
                "plot_id": sid("plot-a"),
                "name": "Vụ 2025",
                "started_on": "2025-03-01",
                "stage": "harvest",
                "closed_on": "2025-09-30",
            },
        ),
        up(
            "season",
            "season-a-2026",
            {
                "plot_id": sid("plot-a"),
                "name": "Vụ 2026",
                "started_on": "2026-03-01",
                "stage": "fruit_growth",
                "expected_harvest_on": "2026-09-15",
                "forecast_yield_kg": "12000",
                "forecast_price_vnd_kg": "85000",
                "forecast_total_cost_vnd": "200000000",
            },
        ),
        up(
            "season",
            "season-b-2026",
            {
                "plot_id": sid("plot-b"),
                "name": "Vụ 2026",
                "started_on": "2026-04-10",
                "stage": "flowering_fruit_set",
            },
        ),
    ),
    mut(
        "care-fert",
        up(
            "care_log",
            "care-fert",
            {
                "season_id": sid("season-a-2026"),
                "occurred_on": "2026-05-02",
                "kind": "fertilizing",
                "note": "Bón NPK đợt 1",
                "inputs": [
                    {
                        "id": sid("in-npk"),
                        "product_name": "NPK 16-16-8",
                        "amount": "50",
                        "unit": "kg",
                    }
                ],
            },
        ),
        # expense linked 1:1 to the care log, created in the same mutation
        up(
            "expense",
            "exp-fert",
            {
                "season_id": sid("season-a-2026"),
                "care_log_id": sid("care-fert"),
                "occurred_on": "2026-05-02",
                "category": "fertilizer",
                "amount_vnd": "1250000",
            },
        ),
    ),
    mut(
        "care-spray",
        up(
            "care_log",
            "care-spray",
            {
                "season_id": sid("season-a-2026"),
                "occurred_on": "2026-06-10",
                "kind": "spraying",
                "inputs": [
                    {
                        "id": sid("in-abamectin"),
                        "product_name": "Abamectin",
                        "amount": "20",
                        "unit": "ml",
                        "active_ingredient": "abamectin",
                    }
                ],
            },
        ),
        up(
            "care_log",
            "care-water",
            {"season_id": sid("season-a-2026"), "occurred_on": "2026-06-12", "kind": "watering"},
        ),
    ),
    mut(
        "expenses",
        up(
            "expense",
            "exp-labor",
            {
                "season_id": sid("season-a-2026"),
                "occurred_on": "2026-06-15",
                "category": "labor",
                "amount_vnd": "3000000",
                "note": "Công phun thuốc",
            },
        ),
        up(
            "expense",
            "exp-power",
            {
                "season_id": sid("season-a-2026"),
                "occurred_on": "2026-06-20",
                "category": "utilities_irrigation",
                "amount_vnd": "800000",
            },
        ),
    ),
    mut(
        "sales",
        up(
            "sale",
            "sale-1",
            {
                "season_id": sid("season-a-2026"),
                "buyer_name": "Thương lái Tư",
                "agreed_on": "2026-08-20",
                "status": "confirmed",
                "total_vnd": "40000000",
                "weight_kg": "500",
            },
        ),
        up(
            "sale",
            "sale-2",
            {
                "season_id": sid("season-a-2026"),
                "buyer_name": "Chợ đầu mối",
                "agreed_on": "2026-08-25",
                "status": "provisional",
            },
        ),
    ),
    mut(
        "payments",
        up(
            "sale_payment",
            "pay-deposit",
            {
                "sale_id": sid("sale-1"),
                "occurred_on": "2026-08-20",
                "kind": "deposit",
                "amount_vnd": "10000000",
            },
        ),
        up(
            "sale_payment",
            "pay-receipt",
            {
                "sale_id": sid("sale-1"),
                "occurred_on": "2026-09-01",
                "kind": "receipt",
                "amount_vnd": "29000000",
            },
        ),
        up(
            "sale_payment",
            "pay-refund",
            {
                "sale_id": sid("sale-1"),
                "occurred_on": "2026-09-02",
                "kind": "refund",
                "amount_vnd": "500000",
                "note": "Trừ hàng hao",
            },
        ),
    ),
    # a tombstone (deleted row) so /v1/snapshot shows deleted_at
    mut("delete-old-plot", rm("plot", "plot-old", 1)),
]


ADMIN_USER = uuid.UUID("22222222-2222-4222-8222-222222222222")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "123456"  # dev seed only; never run the seed against production


async def seed_admin_account(db) -> None:  # type: ignore[no-untyped-def]
    """Admin who signs in with username + password (POST /v1/auth/admin-login)."""
    now = utcnow_ms()
    await db["users"].update_one(
        {"_id": ADMIN_USER},
        {
            "$setOnInsert": {
                "provider": "password",
                "subject": ADMIN_USERNAME,
                "display_name": "Admin",
                "locale": "vi",
                "ai_consent_version": None,
                "ai_consented_at": None,
                "created_at": now,
            }
        },
        upsert=True,
    )
    await db["admin_members"].update_one(
        {"user_id": ADMIN_USER}, {"$setOnInsert": {"created_at": now}}, upsert=True
    )
    await db["admin_credentials"].update_one(
        {"user_id": ADMIN_USER},
        {"$set": {"username": ADMIN_USERNAME, "password_hash": hash_password(ADMIN_PASSWORD)}},
        upsert=True,
    )


async def seed_content(db) -> None:  # type: ignore[no-untyped-def]
    """Empty CN / EU fresh-durian profiles (content comes from the admin UI) + one chat report."""
    now = utcnow_ms()
    for market in ("CN", "EU"):
        await db["standard_profiles"].update_one(
            {"market_code": market, "product_form_code": "fresh"},
            {
                "$setOnInsert": {
                    "_id": uuid.uuid4(),
                    "published_version_id": None,
                    "created_at": now,
                }
            },
            upsert=True,
        )
    await db["chat_reports"].update_one(
        {"user_id": DEMO_USER, "idempotency_key": "seed-report"},
        {
            "$setOnInsert": {
                "_id": uuid.uuid4(),
                "question": "Lá sầu riêng bị vàng từ mép, nguyên nhân là gì?",
                "answer": "Có thể do thiếu kali hoặc úng rễ.",
                "citations": [],
                "reason": "Câu trả lời chưa rõ nguồn",
                "status": "open",
                "created_at": now,
                "updated_at": now,
            }
        },
        upsert=True,
    )


async def main(reset: bool) -> None:
    settings = get_settings()
    client = make_client(settings)
    db = get_db(client, settings)
    try:
        await ensure_indexes(db)
        await db["users"].update_one(
            {"_id": DEMO_USER},
            {
                "$setOnInsert": {
                    "provider": "google",
                    "subject": "demo",
                    "display_name": "Demo Farmer",
                    "locale": "vi",
                    "ai_consent_version": None,
                    "ai_consented_at": None,
                    "created_at": utcnow_ms(),
                }
            },
            upsert=True,
        )
        await db["admin_members"].update_one(
            {"user_id": DEMO_USER}, {"$setOnInsert": {"created_at": utcnow_ms()}}, upsert=True
        )
        await seed_admin_account(db)
        await seed_content(db)
        if reset:
            for coll in (
                "farms",
                "plots",
                "seasons",
                "care_logs",
                "expenses",
                "sales",
                "sale_payments",
                "mutation_receipts",
            ):
                field = "user_id" if coll == "mutation_receipts" else "owner_id"
                await db[coll].delete_many({field: DEMO_USER})
            print("reset demo user data")
        results = await apply_mutations(
            client, db, DEMO_USER, [Mutation.model_validate(m) for m in MUTATIONS]
        )
        for m, r in zip(MUTATIONS, results, strict=True):
            extra = r.get("code") or ""
            print(f"{r['status']:9} {m['ops'][0]['entity']:13} x{len(m['ops'])} {extra}")
    finally:
        await client.close()
    print(f'\ndemo user {DEMO_USER}  ->  sign in with id_token "dev:demo"')
    print(f"admin account  ->  username {ADMIN_USERNAME} / password {ADMIN_PASSWORD}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    asyncio.run(main(ap.parse_args().reset))
