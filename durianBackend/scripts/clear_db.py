"""Drop the whole Mongo database so `scripts.seed` can start from nothing (dev only).

    uv run python -m scripts.clear_db --yes     # APP_ENV=dev; drops MONGO_DB
    uv run python -m scripts.seed --household   # then seed again

Refuses unless APP_ENV=dev. Indexes come back on the next API start or seed. Media files in
object storage and the Qdrant vectors are not touched: re-run the release retry
(`POST /v1/admin/releases/retry`) to rebuild the vectors.
"""

import argparse
import asyncio

from app.config import get_settings
from app.db.client import get_db, make_client


async def main() -> None:
    settings = get_settings()
    if settings.app_env != "dev":
        raise SystemExit(f"refusing: APP_ENV={settings.app_env!r}, this only runs with APP_ENV=dev")
    client = make_client(settings)
    try:
        db = get_db(client, settings)
        await client.drop_database(db.name)
        print(f"dropped database {db.name!r}")
    finally:
        await client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="confirm the drop")
    if not ap.parse_args().yes:
        raise SystemExit("add --yes to drop the database")
    asyncio.run(main())
