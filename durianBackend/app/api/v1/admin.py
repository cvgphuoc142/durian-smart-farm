"""Admin content API: articles, standards, contacts, releases and chat reports.

Documents (Mongo): `knowledge_articles` + `article_versions`,
`standard_profiles` + `standard_versions` (items embedded),
`directory_contacts`, `content_releases`, `chat_reports`. Content has one text, no per-language
copies.
"""

from collections.abc import AsyncIterator
from datetime import date, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import CurrentUser, get_database, require_admin
from app.api.errors import ApiError
from app.content.workflow import (
    WORKING,
    Action,
    Status,
    cut_release,
    new_id,
    next_status,
    page,
    require_draft,
    wire,
)
from app.domain.errors import ErrorCode
from app.rag.indexer import reindex
from app.sync.receipts import utcnow_ms


async def reindex_after(request: Request) -> AsyncIterator[None]:
    """A request that cut a release leaves RAG stale; reconcile once it has been handled.
    Failure is recorded on the release (`error`, retry via /releases/retry), never raised."""
    yield
    state = request.app.state
    if state.embedder is None:
        return
    pending = await state.db["content_releases"].find_one(
        {"state": "current", "index_state": "pending"}
    )
    if pending is not None:
        await reindex(state.db, state.embedder, state.vectors)


router = APIRouter(
    prefix="/v1/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin), Depends(reindex_after)],
)

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]
Admin = Annotated[CurrentUser, Depends(require_admin)]
Limit = Annotated[int, Query(ge=1, le=100)]


class Transition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Action
    note: str | None = None


async def _one(db: Any, coll: str, doc_id: UUID) -> dict[str, Any]:
    doc: dict[str, Any] | None = await db[coll].find_one({"_id": doc_id})
    if doc is None:
        raise ApiError(ErrorCode.not_found)
    return doc


def _links(links: list[str]) -> list[str]:
    cleaned = [x.strip() for x in links if x.strip()]
    if not cleaned:
        raise ApiError(ErrorCode.source_missing, field="source_links")
    return cleaned


# --------------------------------------------------------------------------- articles


class ArticleVersionBody(BaseModel):
    """One article text. There is a single language: whatever the editor writes is what is shown."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    body: str = Field(min_length=1)
    search_keywords: list[str] = []
    category: str | None = None
    disease_code: str | None = None
    source_links: list[str] = []
    plant_parts: list[str] = []
    stages: list[str] = []


def _article_version_wire(v: dict[str, Any]) -> dict[str, Any]:
    return wire(v)


async def _refresh_article(db: Any, article_id: UUID) -> None:
    """Keep the list-friendly summary on the article row in step with its versions."""
    latest = await db["article_versions"].find_one(
        {"article_id": article_id}, sort=[("version_no", -1)]
    )
    if latest is None:
        return
    await db["knowledge_articles"].update_one(
        {"_id": article_id},
        {
            "$set": {
                "latest_version_id": latest["_id"],
                "latest_version_no": latest["version_no"],
                "latest_status": latest["status"],
                "title": latest["title"],
                "disease_code": latest["disease_code"],
            }
        },
    )


async def _insert_article_version(
    db: Any, article_id: UUID, body: ArticleVersionBody
) -> dict[str, Any]:
    links = _links(body.source_links)
    if await db["article_versions"].find_one(
        {"article_id": article_id, "status": {"$in": list(WORKING)}}
    ):
        raise ApiError(
            ErrorCode.validation_failed, "A working draft already exists.", field="status"
        )
    last = await db["article_versions"].find_one(
        {"article_id": article_id}, sort=[("version_no", -1)]
    )
    version = {
        "_id": new_id(),
        "article_id": article_id,
        "version_no": (last["version_no"] if last else 0) + 1,
        "status": "draft",
        **body.model_dump(exclude={"source_links"}),
        "source_links": links,
        "reviewed_by": None,
        "published_at": None,
        "created_at": utcnow_ms(),
    }
    await db["article_versions"].insert_one(version)
    await _refresh_article(db, article_id)
    return version


@router.get("/articles", operation_id="adminListArticles")
async def list_articles(
    db: Db,
    limit: Limit = 25,
    cursor: str | None = None,
    status: Status | None = None,
    q: str | None = None,
) -> dict[str, Any]:
    flt: dict[str, Any] = {}
    if status:
        flt["latest_status"] = status
    if q and q.strip():
        rx = {"$regex": q.strip(), "$options": "i"}
        flt["$or"] = [{"title": rx}, {"disease_code": rx}]
    rows, nxt = await page(db, "knowledge_articles", flt, limit, cursor)
    keep = ("id", "published_version_id", "latest_version_id", "latest_version_no", "latest_status")
    items = [
        {k: w.get(k) for k in (*keep, "title", "disease_code")} for w in (wire(r) for r in rows)
    ]
    return {"items": items, "next_cursor": nxt}


@router.post("/articles", operation_id="adminCreateArticle", status_code=201)
async def create_article(body: ArticleVersionBody, db: Db) -> dict[str, Any]:
    _links(body.source_links)
    article_id = new_id()
    await db["knowledge_articles"].insert_one(
        {"_id": article_id, "published_version_id": None, "created_at": utcnow_ms()}
    )
    return _article_version_wire(await _insert_article_version(db, article_id, body))


@router.get("/articles/{article_id}", operation_id="adminGetArticle")
async def get_article(article_id: UUID, db: Db) -> dict[str, Any]:
    article = await _one(db, "knowledge_articles", article_id)
    versions = (
        await db["article_versions"]
        .find({"article_id": article_id})
        .sort("version_no", -1)
        .to_list()
    )
    return {
        "article": {"id": article["_id"], "published_version_id": article["published_version_id"]},
        "versions": [_article_version_wire(v) for v in versions],
    }


@router.post(
    "/articles/{article_id}/versions", operation_id="adminNewArticleVersion", status_code=201
)
async def new_article_version(article_id: UUID, body: ArticleVersionBody, db: Db) -> dict[str, Any]:
    await _one(db, "knowledge_articles", article_id)
    return _article_version_wire(await _insert_article_version(db, article_id, body))


@router.patch("/article-versions/{version_id}", operation_id="adminEditArticleVersion")
async def edit_article_version(
    version_id: UUID, body: ArticleVersionBody, db: Db
) -> dict[str, Any]:
    v = await _one(db, "article_versions", version_id)
    require_draft(v["status"])
    changes = body.model_dump(exclude={"source_links"}) | {
        "source_links": _links(body.source_links)
    }
    await db["article_versions"].update_one({"_id": version_id}, {"$set": changes})
    await _refresh_article(db, v["article_id"])
    return _article_version_wire(await _one(db, "article_versions", version_id))


@router.post("/article-versions/{version_id}/transition", operation_id="adminArticleTransition")
async def article_transition(
    version_id: UUID, body: Transition, db: Db, admin: Admin
) -> dict[str, Any]:
    v = await _one(db, "article_versions", version_id)
    target = next_status(v["status"], body.action)
    now = utcnow_ms()
    changes: dict[str, Any] = {"status": target}
    if body.action == "approve":
        changes["reviewed_by"] = admin.id
    if body.action == "publish":
        _links(v["source_links"])
        changes["published_at"] = now
        await db["article_versions"].update_many(
            {"article_id": v["article_id"], "status": "published"},
            {"$set": {"status": "unpublished"}},
        )
        await db["knowledge_articles"].update_one(
            {"_id": v["article_id"]}, {"$set": {"published_version_id": version_id}}
        )
    if body.action == "unpublish":
        await db["knowledge_articles"].update_one(
            {"_id": v["article_id"], "published_version_id": version_id},
            {"$set": {"published_version_id": None}},
        )
    await db["article_versions"].update_one({"_id": version_id}, {"$set": changes})
    await _refresh_article(db, v["article_id"])
    if body.action in ("publish", "unpublish"):
        await cut_release(db)
    return _article_version_wire(await _one(db, "article_versions", version_id))


# -------------------------------------------------------------------------- standards


class StandardItemBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    item_key: str = Field(min_length=1)
    title: str = Field(min_length=1)
    body: str | None = None
    source_link: str = ""
    source_checked_at: datetime
    sort_order: int


class StandardVersionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: str | None = None
    source_links: list[str] = []
    effective_on: date | None = None
    items: list[StandardItemBody]


def _items(version_id: UUID, items: list[StandardItemBody]) -> list[dict[str, Any]]:
    keys = [i.item_key for i in items]
    if len(set(keys)) != len(keys):
        raise ApiError(ErrorCode.validation_failed, "Duplicate item_key.", field="items")
    out = []
    for n, i in enumerate(items):
        if not i.source_link.strip():
            raise ApiError(ErrorCode.source_missing, field=f"items.{n}.source_link")
        out.append(
            {
                "id": i.id or new_id(),
                "standard_version_id": version_id,
                "item_key": i.item_key,
                "title": i.title,
                "body": i.body,
                "source_link": i.source_link.strip(),
                "source_checked_at": i.source_checked_at,
                "sort_order": i.sort_order,
            }
        )
    return out


def _standard_wire(v: dict[str, Any]) -> dict[str, Any]:
    return wire(v, drop=("items", "created_at"))


@router.get("/standards", operation_id="adminListStandards")
async def list_standards(db: Db, limit: Limit = 25, cursor: str | None = None) -> dict[str, Any]:
    rows, nxt = await page(db, "standard_profiles", {}, limit, cursor)
    items = []
    for p in rows:
        latest = await db["standard_versions"].find_one(
            {"standard_profile_id": p["_id"]}, sort=[("version_no", -1)]
        )
        items.append(
            {
                "id": p["_id"],
                "market_code": p["market_code"],
                "product_form_code": p["product_form_code"],
                "published_version_id": p["published_version_id"],
                "latest_version_id": latest["_id"] if latest else None,
                "latest_status": latest["status"] if latest else None,
            }
        )
    return {"items": items, "next_cursor": nxt}


@router.get("/standards/{profile_id}", operation_id="adminGetStandard")
async def get_standard(profile_id: UUID, db: Db) -> dict[str, Any]:
    profile = await _one(db, "standard_profiles", profile_id)
    versions = (
        await db["standard_versions"]
        .find({"standard_profile_id": profile_id})
        .sort("version_no", -1)
        .to_list()
    )
    return {
        "profile": wire(profile, drop=("created_at",)),
        "versions": [
            {
                "version": _standard_wire(v),
                "items": sorted((wire(i) for i in v["items"]), key=lambda i: i["sort_order"]),
            }
            for v in versions
        ],
    }


@router.post(
    "/standards/{profile_id}/versions", operation_id="adminNewStandardVersion", status_code=201
)
async def new_standard_version(
    profile_id: UUID, body: StandardVersionBody, db: Db
) -> dict[str, Any]:
    await _one(db, "standard_profiles", profile_id)
    if await db["standard_versions"].find_one(
        {"standard_profile_id": profile_id, "status": {"$in": list(WORKING)}}
    ):
        raise ApiError(
            ErrorCode.validation_failed, "A working draft already exists.", field="status"
        )
    last = await db["standard_versions"].find_one(
        {"standard_profile_id": profile_id}, sort=[("version_no", -1)]
    )
    version_id = new_id()
    version = {
        "_id": version_id,
        "standard_profile_id": profile_id,
        "version_no": (last["version_no"] if last else 0) + 1,
        "status": "draft",
        "title": body.title,
        "description": body.description,
        "source_links": [x.strip() for x in body.source_links if x.strip()],
        "effective_on": body.effective_on.isoformat() if body.effective_on else None,
        "reviewed_by": None,
        "published_at": None,
        "created_at": utcnow_ms(),
        "items": _items(version_id, body.items),
    }
    await db["standard_versions"].insert_one(version)
    return _standard_wire(version)


@router.put("/standard-versions/{version_id}", operation_id="adminReplaceStandardDraft")
async def replace_standard_draft(
    version_id: UUID, body: StandardVersionBody, db: Db
) -> dict[str, Any]:
    v = await _one(db, "standard_versions", version_id)
    require_draft(v["status"])
    await db["standard_versions"].update_one(
        {"_id": version_id},
        {
            "$set": {
                "title": body.title,
                "description": body.description,
                "source_links": [x.strip() for x in body.source_links if x.strip()],
                "effective_on": body.effective_on.isoformat() if body.effective_on else None,
                "items": _items(version_id, body.items),
            }
        },
    )
    return _standard_wire(await _one(db, "standard_versions", version_id))


@router.post("/standard-versions/{version_id}/transition", operation_id="adminStandardTransition")
async def standard_transition(
    version_id: UUID, body: Transition, db: Db, admin: Admin
) -> dict[str, Any]:
    v = await _one(db, "standard_versions", version_id)
    target = next_status(v["status"], body.action)
    now = utcnow_ms()
    changes: dict[str, Any] = {"status": target}
    if body.action == "approve":
        changes["reviewed_by"] = admin.id
    if body.action == "publish":
        if not v["items"]:
            raise ApiError(ErrorCode.source_missing, field="items")
        changes["published_at"] = now
        await db["standard_versions"].update_many(
            {"standard_profile_id": v["standard_profile_id"], "status": "published"},
            {"$set": {"status": "unpublished"}},
        )
        await db["standard_profiles"].update_one(
            {"_id": v["standard_profile_id"]}, {"$set": {"published_version_id": version_id}}
        )
    if body.action == "unpublish":
        await db["standard_profiles"].update_one(
            {"_id": v["standard_profile_id"], "published_version_id": version_id},
            {"$set": {"published_version_id": None}},
        )
    await db["standard_versions"].update_one({"_id": version_id}, {"$set": changes})
    if body.action in ("publish", "unpublish"):
        await cut_release(db)
    return _standard_wire(await _one(db, "standard_versions", version_id))


# --------------------------------------------------------------------------- contacts


class ContactBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Annotated[str, Field(pattern="^(store|expert)$")]
    name: str = Field(min_length=1)
    province: str | None = None
    locality: str | None = None
    address: str | None = None
    phone: str | None = None
    zalo: str | None = None
    contact_url: str | None = None
    source_link: str | None = None
    verified_at: datetime | None = None
    specialty: str | None = None
    description: str | None = None


def _need_channel(c: dict[str, Any]) -> None:
    if not any(c.get(k) for k in ("phone", "zalo", "contact_url")):
        raise ApiError(ErrorCode.contact_channel_required)


def _contact_wire(c: dict[str, Any]) -> dict[str, Any]:
    return wire(c, drop=("created_at",))


@router.get("/contacts", operation_id="adminListContacts")
async def list_contacts(
    db: Db,
    limit: Limit = 25,
    cursor: str | None = None,
    status: Status | None = None,
    kind: str | None = Query(None, pattern="^(store|expert)$"),
) -> dict[str, Any]:
    flt = {k: v for k, v in (("status", status), ("kind", kind)) if v}
    rows, nxt = await page(db, "directory_contacts", flt, limit, cursor)
    return {"items": [_contact_wire(r) for r in rows], "next_cursor": nxt}


@router.post("/contacts", operation_id="adminCreateContact", status_code=201)
async def create_contact(body: ContactBody, db: Db) -> dict[str, Any]:
    contact = {
        "_id": new_id(),
        **body.model_dump(),
        "status": "draft",
        "revision": 1,
        "reviewed_at": None,
        "created_at": utcnow_ms(),
    }
    _need_channel(contact)
    await db["directory_contacts"].insert_one(contact)
    return _contact_wire(contact)


@router.patch("/contacts/{contact_id}", operation_id="adminEditContact")
async def edit_contact(contact_id: UUID, body: ContactBody, db: Db) -> dict[str, Any]:
    c = await _one(db, "directory_contacts", contact_id)
    changes = body.model_dump()
    _need_channel(changes)
    await db["directory_contacts"].update_one(
        {"_id": contact_id}, {"$set": changes, "$inc": {"revision": 1}}
    )
    if c["status"] == "published":
        await cut_release(db)
    return _contact_wire(await _one(db, "directory_contacts", contact_id))


@router.post("/contacts/{contact_id}/transition", operation_id="adminContactTransition")
async def contact_transition(
    contact_id: UUID, body: Transition, db: Db, admin: Admin
) -> dict[str, Any]:
    c = await _one(db, "directory_contacts", contact_id)
    target = next_status(c["status"], body.action)
    if body.action == "publish":
        _need_channel(c)
    changes: dict[str, Any] = {"status": target}
    if body.action == "approve":
        changes["reviewed_at"] = utcnow_ms()
    await db["directory_contacts"].update_one({"_id": contact_id}, {"$set": changes})
    if body.action in ("publish", "unpublish"):
        await cut_release(db)
    return _contact_wire(await _one(db, "directory_contacts", contact_id))


# ------------------------------------------------------------- releases, chat reports


@router.get("/releases", operation_id="adminListReleases")
async def list_releases(db: Db, limit: Limit = 25, cursor: str | None = None) -> dict[str, Any]:
    rows, nxt = await page(db, "content_releases", {}, limit, cursor)
    return {
        "items": [wire(r, drop=("_id", "pack", "index_state")) for r in rows],
        "next_cursor": nxt,
    }


@router.post("/releases/retry", operation_id="adminRetryRelease", status_code=202)
async def retry_release(db: Db) -> dict[str, Any]:
    """Rebuild the release when the latest one failed; otherwise report the current one."""
    last = await db["content_releases"].find_one(sort=[("release_no", -1)])
    if last is None or last["state"] == "failed":
        last = await cut_release(db)
    elif last.get("index_state") == "failed":
        await db["content_releases"].update_one(
            {"_id": last["_id"]}, {"$set": {"index_state": "pending"}}
        )  # reindex_after picks it up
    return wire(last, drop=("_id", "pack", "index_state"))


@router.get("/chat-reports", operation_id="adminListChatReports")
async def list_chat_reports(
    db: Db, limit: Limit = 25, cursor: str | None = None, status: str | None = None
) -> dict[str, Any]:
    if status is not None and status not in _REPORT_STATUS:
        raise ApiError(ErrorCode.validation_failed, field="status")
    rows, nxt = await page(db, "chat_reports", {"status": status} if status else {}, limit, cursor)
    return {"items": [_report_wire(r) for r in rows], "next_cursor": nxt}


_REPORT_STATUS = ("open", "in_progress", "resolved", "dismissed")


def _report_wire(r: dict[str, Any]) -> dict[str, Any]:
    return wire(r, drop=("idempotency_key",))


class ChatReportPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Annotated[str, Field(pattern="^(open|in_progress|resolved|dismissed)$")]


@router.patch("/chat-reports/{report_id}", operation_id="adminUpdateChatReport")
async def update_chat_report(report_id: UUID, body: ChatReportPatch, db: Db) -> dict[str, Any]:
    await _one(db, "chat_reports", report_id)
    await db["chat_reports"].update_one(
        {"_id": report_id}, {"$set": {"status": body.status, "updated_at": utcnow_ms()}}
    )
    return _report_wire(await _one(db, "chat_reports", report_id))
