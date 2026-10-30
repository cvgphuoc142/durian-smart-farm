"""One-off repair: content rows whose `_id` was stored as a string become BSON UUIDs.

    uv run python -m scripts.rekey_content_ids           # count what would change
    uv run python -m scripts.rekey_content_ids --apply   # change it

Touches only `_id`s and id references of the content collections; no text is rewritten, so
admin edits survive. Safe to re-run. Take a backup first (mongodump).
"""

import argparse
import asyncio

from app.config import get_settings
from app.db.client import get_db, make_client
from scripts.seed import rekey_string_ids

COLLECTIONS = (
    "article_versions",
    "knowledge_articles",
    "standard_profiles",
    "standard_versions",
    "directory_contacts",
)


async def main(apply: bool) -> None:
    settings = get_settings()
    client = make_client(settings)
    db = get_db(client, settings)
    try:
        for name in COLLECTIONS:
            n = await db[name].count_documents({"_id": {"$type": "string"}})
            print(f"{name}: {n} string _id")
        if apply:
            await rekey_string_ids(db)
            print("done; reindex RAG with POST /v1/admin/releases/retry if articles were touched")
    finally:
        await client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    asyncio.run(main(ap.parse_args().apply))
