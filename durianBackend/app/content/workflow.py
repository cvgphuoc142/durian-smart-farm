"""Shared admin content rules: the draft → published workflow, cursor paging, and the
content release that every live change (publish, unpublish, new published revision) cuts."""

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pymongo.asynchronous.database import AsyncDatabase

from app.api.errors import ApiError
from app.domain.errors import ErrorCode
from app.sync.receipts import iso, utcnow_ms

Locale = Literal["vi", "en"]
Status = Literal["draft", "in_review", "approved", "published", "unpublished"]
Action = Literal["submit_review", "approve", "publish", "unpublish", "reject_to_draft"]

_TRANSITIONS: dict[tuple[str, str], Status] = {
    ("draft", "submit_review"): "in_review",
    ("in_review", "approve"): "approved",
    ("in_review", "reject_to_draft"): "draft",
    ("approved", "publish"): "published",
    ("approved", "reject_to_draft"): "draft",
    ("published", "unpublish"): "unpublished",
    ("unpublished", "reject_to_draft"): "draft",
}
WORKING = ("draft", "in_review", "approved")


def next_status(current: str, action: str) -> Status:
    target = _TRANSITIONS.get((current, action))
    if target is not None:
        return target
    if action == "publish" and current in ("draft", "in_review"):
        raise ApiError(ErrorCode.not_approved)
    raise ApiError(ErrorCode.invalid_transition)


def require_draft(status: str) -> None:
    if status == "published":
        raise ApiError(ErrorCode.published_immutable)
    if status != "draft":
        raise ApiError(ErrorCode.invalid_transition, "Only a draft can be edited.")


def wire(doc: dict[str, Any], drop: tuple[str, ...] = ()) -> dict[str, Any]:
    return {("id" if k == "_id" else k): v for k, v in doc.items() if k not in drop}


def new_id() -> UUID:
    return uuid.uuid4()


def latest_by(rows: list[dict[str, Any]], key: str, value: str) -> dict[str, Any] | None:
    """Highest revision of the translations whose `key` equals `value`."""
    same = [r for r in rows if r[key] == value]
    return max(same, key=lambda r: r["revision_no"], default=None)


def go_live(translations: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    """Newest revision per locale becomes published, any older published one is retired."""
    newest = {t["locale"]: latest_by(translations, "locale", t["locale"]) for t in translations}
    out = []
    for t in translations:
        if t is newest[t["locale"]]:
            t = {**t, "status": "published", "published_at": now}
        elif t["status"] == "published":
            t = {**t, "status": "unpublished"}
        out.append(t)
    return out


def take_down(translations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {**t, "status": "unpublished"} if t["status"] == "published" else t for t in translations
    ]


async def page(
    db: AsyncDatabase,  # type: ignore[type-arg]
    coll: str,
    flt: dict[str, Any],
    limit: int,
    cursor: str | None,
) -> tuple[list[dict[str, Any]], str | None]:
    """Newest first. The cursor is `<created_at>|<id>` of the last row already returned."""
    clauses = [flt] if flt else []
    if cursor:
        ts_s, _, id_s = cursor.partition("|")
        try:
            ts, cid = datetime.fromisoformat(ts_s), UUID(id_s)
        except ValueError:
            raise ApiError(ErrorCode.validation_failed, field="cursor") from None
        clauses.append(
            {"$or": [{"created_at": {"$lt": ts}}, {"created_at": ts, "_id": {"$lt": cid}}]}
        )
    query = {"$and": clauses} if clauses else {}
    rows = (
        await db[coll]
        .find(query)
        .sort([("created_at", -1), ("_id", -1)])
        .limit(limit + 1)
        .to_list(limit + 1)
    )
    nxt = None
    if len(rows) > limit:
        rows = rows[:limit]
        nxt = f"{rows[-1]['created_at'].isoformat()}|{rows[-1]['_id']}"
    return rows, nxt


SCHEMA_VERSION = 1


def article_row(v: dict[str, Any], t: dict[str, Any]) -> dict[str, Any]:
    """The wire `Article` for one translation revision of a version."""
    return {
        "id": v["article_id"],
        "version_id": v["_id"],
        "version_no": v["version_no"],
        "translation_revision": t["revision_no"],
        "locale": t["locale"],
        "is_fallback": False,
        "source_locale": v["source_locale"],
        "title": t["title"],
        "body": t["body"],
        "category": v["category"],
        "disease_code": v["disease_code"],
        "plant_parts": v["plant_parts"],
        "stages": v["stages"],
        "source_links": v["source_links"],
        "published_at": iso(t.get("published_at") or v["published_at"] or v["created_at"]),
    }


def _published(translations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [t for t in translations if t["status"] == "published"]


def _ids(pack: dict[str, Any]) -> set[str]:
    ids = {str(a["version_id"]) for a in pack.get("articles", [])}
    ids |= {str(v["id"]) for v in pack.get("standard_versions", [])}
    ids |= {str(c["id"]) for c in pack.get("contacts", [])}
    return ids


async def build_pack(db: AsyncDatabase) -> dict[str, Any]:  # type: ignore[type-arg]
    """Everything published right now, in the shape of the app's `ContentRelease`."""
    articles: list[dict[str, Any]] = []
    async for v in db["article_versions"].find({"status": "published"}).sort("_id"):
        articles += [article_row(v, t) for t in _published(v["translations"])]
    codes = sorted({a["disease_code"] for a in articles if a["disease_code"]})

    profiles, versions = [], []
    async for p in db["standard_profiles"].find().sort("_id"):
        name = f"{p['market_code']} / {p['product_form_code']}"
        live = None
        if p["published_version_id"]:
            live = await db["standard_versions"].find_one({"_id": p["published_version_id"]})
        if live and live["status"] == "published":
            for t in _published(live["translations"]):
                by_item = {i["standard_item_id"]: i for i in t["items"]}
                versions.append(
                    {
                        "id": live["_id"],
                        "profile_id": p["_id"],
                        "version_no": live["version_no"],
                        "effective_on": live["effective_on"],
                        "source_locale": live["source_locale"],
                        "locale": t["locale"],
                        "is_fallback": False,
                        "source_links": live["source_links"],
                        "items": [
                            {
                                "id": i["id"],
                                "item_key": i["item_key"],
                                "sort_order": i["sort_order"],
                                "title": by_item[i["id"]]["title"],
                                "body": by_item[i["id"]].get("body") or "",
                                "source_link": i["source_link"],
                                "source_checked_at": iso(i["source_checked_at"]),
                            }
                            for i in sorted(live["items"], key=lambda i: i["sort_order"])
                        ],
                    }
                )
            first = _published(live["translations"])
            name = first[0]["title"] if first else name
        profiles.append(
            {
                "id": p["_id"],
                "market_code": p["market_code"],
                "product_form_code": p["product_form_code"],
                "name": name,
                "published_version_id": p["published_version_id"] if live else None,
            }
        )

    contacts = []
    async for c in db["directory_contacts"].find({"status": "published"}).sort("_id"):
        # Contact translations store `revision`; latest_by expects `revision_no`.
        text = latest_by(
            [{**t, "revision_no": t.get("revision", 0)} for t in c["translations"]], "locale", "vi"
        ) or (
            c["translations"][0] if c["translations"] else {}
        )
        contacts.append(
            {
                **{
                    k: c.get(k)
                    for k in (
                        "kind",
                        "name",
                        "province",
                        "locality",
                        "address",
                        "phone",
                        "zalo",
                        "contact_url",
                        "source_link",
                    )  # fmt: skip
                },
                "id": c["_id"],
                "verified_at": iso(c["verified_at"]) if c.get("verified_at") else None,
                "description": text.get("description"),
                "specialty": text.get("specialty"),
            }
        )
    return {
        "diseases": [{"code": code, "names": {"vi": code, "en": code}} for code in codes],
        "articles": articles,
        "standard_profiles": profiles,
        "standard_versions": versions,
        "contacts": contacts,
    }


def _plain(value: Any) -> Any:
    """JSON-safe copy (UUID → str) so the pack hashes and serialises the same everywhere."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    return value


async def cut_release(db: AsyncDatabase) -> dict[str, Any]:  # type: ignore[type-arg]
    """Snapshot what is published now as the new current release (previous one → ready)."""
    pack = _plain(await build_pack(db))
    last = await db["content_releases"].find_one(sort=[("release_no", -1)])
    previous = await db["content_releases"].find_one({"state": "current"})
    pack["tombstones"] = sorted(_ids(previous["pack"]) - _ids(pack)) if previous else []
    no = (last["release_no"] if last else 0) + 1
    locales = sorted(
        {a["locale"] for a in pack["articles"]} | {v["locale"] for v in pack["standard_versions"]}
    )
    await db["content_releases"].update_many({"state": "current"}, {"$set": {"state": "ready"}})
    release = {
        "_id": new_id(),
        "release_no": no,
        "state": "current",
        "created_at": utcnow_ms(),
        "checksum": hashlib.sha256(
            json.dumps(pack, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest(),
        "available_locales": locales or ["vi"],
        "index_version": f"idx-{no}",
        "error": None,
        "pack": pack,
    }
    await db["content_releases"].insert_one(release)
    return release
