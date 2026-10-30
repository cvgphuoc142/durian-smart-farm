"""Seed a demo household through the real sync engine (rules + receipts apply).

    uv run python -m scripts.seed                        # content + scan models: idempotent
    uv run python -m scripts.seed --household [--reset]  # + the demo user's farm (dev only)

Admin account: admin / 123456 via POST /v1/auth/admin-login.
Demo user 11111111-1111-4111-8111-111111111111 (also an admin). Sign in with
POST /v1/auth/session {"provider":"google","id_token":"dev:demo"} when APP_ENV=dev.
"""

import argparse
import asyncio
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.auth.store import hash_password
from app.config import get_settings
from app.content.workflow import _plain, build_pack, cut_release
from app.db.client import get_db, make_client
from app.db.indexes import ensure_indexes
from app.schemas.sync import Mutation
from app.sync.engine import apply_mutations
from app.sync.receipts import utcnow_ms
from scripts.publish_models import main as publish_models
from scripts.seed_content_data import ARTICLES, CONTACTS, STANDARDS

# Fixed so re-seeding yields an identical pack and cuts no new release.
CHECKED_AT = datetime(2026, 10, 29, tzinfo=UTC)
DEFAULT_MODELS_DIR = Path(__file__).resolve().parents[2] / "durianMobile" / "assets" / "models"
DEMO_USER = uuid.UUID("11111111-1111-4111-8111-111111111111")
_NS = uuid.UUID("00000000-0000-4000-8000-00000000d0d0")


def sid(name: str) -> str:
    """Deterministic id so re-seeding hits the receipts instead of duplicating rows."""
    return str(uuid.uuid5(_NS, name))


def cid(name: str) -> uuid.UUID:
    """`sid` as a real UUID: content collections key rows by BSON UUID, like the admin API does."""
    return uuid.UUID(sid(name))


def _as_uuid(value: Any) -> Any:
    return uuid.UUID(value) if isinstance(value, str) else value


async def rekey_string_ids(db) -> None:  # type: ignore[no-untyped-def]
    """Older seeds stored content ids as strings, which no UUID query (sync rules, admin) can match.
    Re-insert those rows under a UUID `_id` and turn their id references into UUIDs too."""
    refs = {
        "article_versions": ("article_id",),
        "knowledge_articles": ("latest_version_id", "published_version_id"),
        "standard_profiles": ("published_version_id",),
        "standard_versions": ("standard_profile_id",),
        "directory_contacts": (),
    }
    for name, fields in refs.items():
        coll = db[name]
        async for doc in coll.find({"_id": {"$type": "string"}}):
            old = doc["_id"]
            doc["_id"] = _as_uuid(old)
            for f in fields:
                if f in doc:
                    doc[f] = _as_uuid(doc[f])
            for item in doc.get("items", []):
                for f in ("id", "standard_version_id"):
                    item[f] = _as_uuid(item[f])
            await coll.delete_one({"_id": old})  # first: unique indexes would reject the copy
            await coll.insert_one(doc)
        for f in fields:
            async for doc in coll.find({f: {"$type": "string"}}, {f: 1}):
                await coll.update_one({"_id": doc["_id"]}, {"$set": {f: _as_uuid(doc[f])}})


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
ADMIN_PASSWORD = "123456"  # APP_ENV=dev only; elsewhere the admin comes from SEED_ADMIN_* env


async def seed_admin_account(db, username: str, password: str) -> None:  # type: ignore[no-untyped-def]
    """Admin who signs in with username + password (POST /v1/auth/admin-login)."""
    now = utcnow_ms()
    await db["users"].update_one(
        {"_id": ADMIN_USER},
        {
            "$setOnInsert": {
                "provider": "password",
                "subject": username,
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
        {"$set": {"username": username, "password_hash": hash_password(password)}},
        upsert=True,
    )


async def seed_content(db, dev: bool) -> None:  # type: ignore[no-untyped-def]
    """Publish the knowledge a fresh install needs (articles, CN / EU checklists, contacts) and
    one chat report. Rows have fixed ids, so re-running updates them in place; a new content
    release is cut only when what is published changed."""
    now = utcnow_ms()
    await rekey_string_ids(db)
    for a in ARTICLES:
        article_id, version_id = cid(f"article:{a['key']}"), cid(f"article-v:{a['key']}")
        fields = {k: v for k, v in a.items() if k != "key"}
        await db["article_versions"].update_one(
            {"_id": version_id},
            {
                "$set": {"status": "published", **fields},
                "$setOnInsert": {
                    "article_id": article_id,
                    "version_no": 1,
                    "reviewed_by": ADMIN_USER,
                    "published_at": now,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        await db["knowledge_articles"].update_one(
            {"_id": article_id},
            {
                "$set": {
                    "latest_version_id": version_id,
                    "latest_version_no": 1,
                    "latest_status": "published",
                    "published_version_id": version_id,
                    "title": a["title"],
                    "disease_code": a["disease_code"],
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    for market, std in STANDARDS.items():
        profile = await db["standard_profiles"].find_one_and_update(
            {"market_code": market, "product_form_code": "fresh"},
            {
                "$setOnInsert": {
                    "_id": uuid.uuid4(),
                    "published_version_id": None,
                    "created_at": now,
                }
            },
            upsert=True,
            return_document=True,
        )
        version_id = cid(f"standard-v:{market}")
        items = [
            {
                "id": cid(f"standard-item:{market}:{key}"),
                "standard_version_id": version_id,
                "item_key": key,
                "title": title,
                "body": body,
                "source_link": link,
                "source_checked_at": CHECKED_AT,
                "sort_order": n,
            }
            for n, (key, title, body, link) in enumerate(std["items"], start=1)
        ]
        await db["standard_versions"].update_one(
            {"standard_profile_id": profile["_id"], "version_no": 1},
            {
                "$set": {
                    "status": "published",
                    "title": std["title"],
                    "description": std["description"],
                    "source_links": std["source_links"],
                    "effective_on": std["effective_on"],
                    "items": items,
                },
                "$setOnInsert": {
                    "_id": version_id,
                    "reviewed_by": ADMIN_USER,
                    "published_at": now,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        stored = await db["standard_versions"].find_one(
            {"standard_profile_id": profile["_id"], "version_no": 1}
        )
        await db["standard_profiles"].update_one(
            {"_id": profile["_id"]}, {"$set": {"published_version_id": stored["_id"]}}
        )

    for c in CONTACTS:
        fields = {k: v for k, v in c.items() if k != "key"}
        await db["directory_contacts"].update_one(
            {"_id": cid(f"contact:{c['key']}")},
            {
                "$set": {
                    "status": "published",
                    "verified_at": CHECKED_AT,
                    "address": None,
                    "phone": None,
                    "zalo": None,
                    "specialty": None,
                    **fields,
                },
                "$setOnInsert": {"revision": 1, "reviewed_at": now, "created_at": now},
            },
            upsert=True,
        )

    current = await db["content_releases"].find_one({"state": "current"})
    pack = _plain(await build_pack(db))
    if current is None or {k: v for k, v in current["pack"].items() if k != "tombstones"} != pack:
        await cut_release(db)
        print("cut a new content release (POST /v1/admin/releases/retry reindexes RAG)")

    if not dev:
        return
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


async def main(reset: bool, household: bool, models: Path | None) -> None:
    settings = get_settings()
    client = make_client(settings)
    db = get_db(client, settings)
    try:
        await ensure_indexes(db)
        dev = settings.app_env == "dev"
        if household and not dev:
            raise SystemExit("--household is for APP_ENV=dev only")
        admin: tuple[str, str] | None = (ADMIN_USERNAME, ADMIN_PASSWORD) if dev else None
        if not dev and (name := os.environ.get("SEED_ADMIN_USERNAME")):
            if not (pw := os.environ.get("SEED_ADMIN_PASSWORD")):
                raise SystemExit("SEED_ADMIN_USERNAME is set but SEED_ADMIN_PASSWORD is not")
            admin = (name, pw)
        if dev:
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
        if admin:
            await seed_admin_account(db, *admin)
        await seed_content(db, dev)
        if reset and household:
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
        mutations = MUTATIONS if household else []
        results = await apply_mutations(
            client, db, DEMO_USER, [Mutation.model_validate(m) for m in mutations]
        )
        for m, r in zip(mutations, results, strict=True):
            extra = r.get("code") or ""
            print(f"{r['status']:9} {m['ops'][0]['entity']:13} x{len(m['ops'])} {extra}")
    finally:
        await client.close()
    if models is not None:
        # Same code path as `python -m scripts.publish_models`; re-running skips what exists.
        if await publish_models(
            models / "manifest.json", models, "beta", "Mô hình nhận diện bệnh", True
        ):
            raise SystemExit("scan models were not published (see above)")
    if dev:
        print(f'\ndemo user {DEMO_USER}  ->  sign in with id_token "dev:demo"')
    if admin:
        print(
            f"admin account  ->  username {admin[0]}" + (f" / password {admin[1]}" if dev else "")
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="with --household: wipe it first")
    ap.add_argument(
        "--household",
        action="store_true",
        help="also seed the demo user's farm / plots / seasons (dev only; App Review signs in "
        "with their own account and starts empty)",
    )
    ap.add_argument(
        "--models-dir",
        type=Path,
        default=DEFAULT_MODELS_DIR,
        help="folder with manifest.json and the .onnx files to publish for download "
        "(pass an empty string to skip)",
    )
    args = ap.parse_args()
    models = args.models_dir if str(args.models_dir) not in ("", ".") else None
    asyncio.run(main(args.reset, args.household, models))
