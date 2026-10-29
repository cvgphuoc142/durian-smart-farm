"""All indexes, applied idempotently at startup (`ensure_indexes`).

Household collections lead every index with `owner_id` (all queries are owner-scoped).
Uniqueness among LIVE rows uses partial unique indexes; "live" is `deleted_at: null`
(`$type: "null"`, since partial filters do not take an `$eq: null`). The index names are
read by sync/handlers.py to turn a race-lost insert into the right error code.
"""

from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.asynchronous.database import AsyncDatabase

_LIVE = {"deleted_at": {"$type": "null"}}

INDEXES: dict[str, list[IndexModel]] = {
    "media_assets": [
        IndexModel(
            [("owner_id", ASCENDING), ("sha256", ASCENDING)],
            name="media_sha256_live",
            unique=True,
            partialFilterExpression=_LIVE,
        )
    ],
    "farms": [IndexModel([("owner_id", ASCENDING)])],
    "plots": [
        IndexModel([("owner_id", ASCENDING), ("farm_id", ASCENDING)]),
        IndexModel(
            [("farm_id", ASCENDING), ("name", ASCENDING)],
            name="plot_name_live",
            unique=True,
            partialFilterExpression=_LIVE,
        ),
    ],
    "seasons": [
        IndexModel([("owner_id", ASCENDING), ("plot_id", ASCENDING)]),
        IndexModel(
            [("plot_id", ASCENDING)],
            name="one_open_season_per_plot",
            unique=True,
            partialFilterExpression={**_LIVE, "closed_on": {"$type": "null"}},
        ),
    ],
    "care_logs": [
        IndexModel([("owner_id", ASCENDING), ("season_id", ASCENDING), ("occurred_on", ASCENDING)]),
        IndexModel([("owner_id", ASCENDING), ("case_id", ASCENDING)]),
        IndexModel([("owner_id", ASCENDING), ("photo_id", ASCENDING)]),
    ],
    "expenses": [
        IndexModel([("owner_id", ASCENDING), ("season_id", ASCENDING), ("occurred_on", ASCENDING)]),
        IndexModel(
            [("care_log_id", ASCENDING)],
            name="expense_care_log_live",
            unique=True,
            partialFilterExpression={**_LIVE, "care_log_id": {"$type": "binData"}},
        ),
    ],
    "sales": [
        IndexModel([("owner_id", ASCENDING), ("season_id", ASCENDING), ("status", ASCENDING)])
    ],
    "sale_payments": [
        IndexModel([("owner_id", ASCENDING), ("sale_id", ASCENDING), ("occurred_on", ASCENDING)])
    ],
    "users": [IndexModel([("provider", ASCENDING), ("subject", ASCENDING)], unique=True)],
    "sessions": [
        IndexModel([("token_hash", ASCENDING)], unique=True),
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
    ],
    "admin_members": [IndexModel([("user_id", ASCENDING)], unique=True)],
    "admin_credentials": [
        IndexModel([("username", ASCENDING)], unique=True),
        IndexModel([("user_id", ASCENDING)], unique=True),
    ],
    "knowledge_articles": [IndexModel([("created_at", DESCENDING)])],
    "article_versions": [
        IndexModel([("article_id", ASCENDING), ("version_no", ASCENDING)], unique=True)
    ],
    "standard_profiles": [
        IndexModel([("market_code", ASCENDING), ("product_form_code", ASCENDING)], unique=True)
    ],
    "standard_versions": [
        IndexModel([("standard_profile_id", ASCENDING), ("version_no", ASCENDING)], unique=True)
    ],
    "directory_contacts": [IndexModel([("created_at", DESCENDING)])],
    "content_releases": [IndexModel([("release_no", ASCENDING)], unique=True)],
    "model_versions": [
        IndexModel(
            [("entry.model_id", ASCENDING), ("entry.version", ASCENDING)],
            name="model_version_unique",
            unique=True,
        ),
        IndexModel([("status", ASCENDING), ("entry.plant_part", ASCENDING)]),
    ],
    "mutation_receipts": [
        IndexModel([("user_id", ASCENDING), ("mutation_id", ASCENDING)], unique=True)
    ],
    "chat_rate_limits": [IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0)],
    "chat_reports": [
        IndexModel([("user_id", ASCENDING), ("idempotency_key", ASCENDING)], unique=True)
    ],
}


async def ensure_indexes(db: AsyncDatabase) -> None:  # type: ignore[type-arg]
    for name, models in INDEXES.items():
        await db[name].create_indexes(models)
