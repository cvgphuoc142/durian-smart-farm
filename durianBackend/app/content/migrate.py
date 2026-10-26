"""One-off, idempotent: fold per-locale `translations[]` (old content shape) into the single text
the admin and the app now use. Picks Vietnamese, else the source locale, else any; the newest
revision of it. Runs at startup and does nothing once no document has `translations`."""

import logging
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.content.workflow import cut_release

log = logging.getLogger("durian.content")


def _best(translations: list[dict[str, Any]], source_locale: str | None) -> dict[str, Any]:
    def rank(t: dict[str, Any]) -> tuple[bool, bool, int]:
        loc = t.get("locale")
        return (loc == "vi", loc == source_locale, t.get("revision_no", t.get("revision", 0)))

    return max(translations, key=rank)


async def migrate_single_locale(db: AsyncDatabase) -> int:  # type: ignore[type-arg]
    changed = 0
    async for v in db["article_versions"].find({"translations": {"$exists": True}}):
        t = _best(v["translations"], v.get("source_locale")) if v["translations"] else {}
        await db["article_versions"].update_one(
            {"_id": v["_id"]},
            {
                "$set": {
                    "title": t.get("title") or "(chưa có tiêu đề)",
                    "body": t.get("body") or "",
                    "search_keywords": t.get("search_keywords", []),
                },
                "$unset": {"translations": "", "source_locale": ""},
            },
        )
        latest = await db["article_versions"].find_one(
            {"article_id": v["article_id"]}, sort=[("version_no", -1)]
        )
        if latest:
            await db["knowledge_articles"].update_one(
                {"_id": v["article_id"]},
                {"$set": {"title": latest.get("title") or t.get("title")}},
            )
        changed += 1
    async for s in db["standard_versions"].find({"translations": {"$exists": True}}):
        t = _best(s["translations"], s.get("source_locale")) if s["translations"] else {}
        by_item = {i["standard_item_id"]: i for i in t.get("items", [])}
        items = [
            {
                **i,
                "title": by_item.get(i["id"], {}).get("title") or i["item_key"],
                "body": by_item.get(i["id"], {}).get("body"),
            }
            for i in s["items"]
        ]
        await db["standard_versions"].update_one(
            {"_id": s["_id"]},
            {
                "$set": {
                    "title": t.get("title") or "(chưa có tiêu đề)",
                    "description": t.get("description"),
                    "items": items,
                },
                "$unset": {"translations": "", "source_locale": ""},
            },
        )
        changed += 1
    async for c in db["directory_contacts"].find({"translations": {"$exists": True}}):
        t = _best(c["translations"], c.get("source_locale")) if c["translations"] else {}
        await db["directory_contacts"].update_one(
            {"_id": c["_id"]},
            {
                "$set": {
                    "specialty": t.get("specialty"),
                    "description": t.get("description"),
                },
                "$unset": {"translations": "", "source_locale": ""},
            },
        )
        changed += 1
    await db["standard_profiles"].update_many({}, {"$unset": {"source_locale": ""}})
    if changed:
        log.info("folded %s documents to single-language content", changed)
        await cut_release(db)
    return changed
