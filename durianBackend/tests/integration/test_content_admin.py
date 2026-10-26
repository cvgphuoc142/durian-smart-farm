"""Admin content is one text per item (no locales); a publish lands in the release the app pulls."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient
from pymongo import MongoClient

from tests.integration.test_identity import bearer, login


def _admin(auth_api: TestClient, replset_uri: str) -> dict[str, str]:
    s = login(auth_api, "editor")
    mc: MongoClient[Any] = MongoClient(replset_uri, tz_aware=True, uuidRepresentation="standard")
    mc[auth_api.app.state.db.name]["admin_members"].insert_one(
        {"user_id": uuid.UUID(s["user"]["id"])}
    )
    mc.close()
    return bearer(s)


def _publish(client: TestClient, h: dict[str, str], path: str) -> None:
    for action in ("submit_review", "approve", "publish"):
        r = client.post(path, json={"action": action}, headers=h)
        assert r.status_code == 200, r.text


def test_article_standard_contact_have_no_locale(auth_api: TestClient, replset_uri: str) -> None:
    h = _admin(auth_api, replset_uri)

    a = auth_api.post(
        "/v1/admin/articles",
        json={
            "title": "Bệnh nấm hồng",
            "body": "Cắt tỉa cành bệnh.\n\nPhun thuốc đúng liều.",
            "source_links": ["https://example.org/nam-hong"],
            "disease_code": "pink_disease",
        },
        headers=h,
    )
    assert a.status_code == 201, a.text
    assert "translations" not in a.json() and "source_locale" not in a.json()
    _publish(auth_api, h, f"/v1/admin/article-versions/{a.json()['id']}/transition")
    # a published text is immutable; changes go through a new version
    edit = auth_api.patch(
        f"/v1/admin/article-versions/{a.json()['id']}",
        json={"title": "x", "body": "y", "source_links": ["https://e.org"]},
        headers=h,
    )
    assert edit.json()["code"] == "published_immutable"

    profile = auth_api.get("/v1/admin/standards", headers=h)
    # the standard profiles come from the seed; create one directly for the test
    mc: MongoClient[Any] = MongoClient(replset_uri, tz_aware=True, uuidRepresentation="standard")
    pid = uuid.uuid4()
    mc[auth_api.app.state.db.name]["standard_profiles"].insert_one(
        {
            "_id": pid,
            "market_code": "CN",
            "product_form_code": "fresh",
            "published_version_id": None,
            "created_at": datetime.now(UTC),
        }
    )
    mc.close()
    assert profile.status_code == 200
    v = auth_api.post(
        f"/v1/admin/standards/{pid}/versions",
        json={
            "title": "Tiêu chuẩn CN",
            "source_links": ["https://example.org/cn"],
            "items": [
                {
                    "item_key": "mrl",
                    "title": "Dư lượng thuốc",
                    "body": "Dưới ngưỡng MRL.",
                    "source_link": "https://example.org/mrl",
                    "source_checked_at": "2026-10-01T00:00:00Z",
                    "sort_order": 1,
                }
            ],
        },
        headers=h,
    )
    assert v.status_code == 201, v.text
    _publish(auth_api, h, f"/v1/admin/standard-versions/{v.json()['id']}/transition")

    c = auth_api.post(
        "/v1/admin/contacts",
        json={
            "kind": "expert",
            "name": "Kỹ sư Lan",
            "phone": "0900000000",
            "specialty": "Bệnh nấm",
            "description": "Tư vấn vườn sầu riêng",
        },
        headers=h,
    )
    assert c.status_code == 201, c.text
    _publish(auth_api, h, f"/v1/admin/contacts/{c.json()['id']}/transition")

    manifest = auth_api.get("/v1/content/manifest", headers=h).json()
    assert "available_locales" not in manifest
    release = auth_api.get(f"/v1/content/releases/{manifest['release_no']}", headers=h).json()
    [art] = release["articles"]
    assert art["title"] == "Bệnh nấm hồng"
    assert not {"locale", "translation_revision", "is_fallback", "source_locale"} & art.keys()
    [ver] = release["standard_versions"]
    assert ver["items"][0]["title"] == "Dư lượng thuốc" and "locale" not in ver
    [ct] = release["contacts"]
    assert ct["specialty"] == "Bệnh nấm" and ct["description"] == "Tư vấn vườn sầu riêng"

    text = auth_api.get(f"/v1/content/article-versions/{art['version_id']}", headers=h)
    assert text.status_code == 200 and text.json()["body"].startswith("Cắt tỉa")


def test_legacy_translations_are_folded(replset_uri: str) -> None:
    import asyncio

    from pymongo import AsyncMongoClient

    from app.content.migrate import migrate_single_locale

    async def run() -> None:
        client: AsyncMongoClient[Any] = AsyncMongoClient(
            replset_uri, tz_aware=True, uuidRepresentation="standard"
        )
        db = client[f"t_{uuid.uuid4().hex[:12]}"]
        aid, vid = uuid.uuid4(), uuid.uuid4()
        await db["knowledge_articles"].insert_one({"_id": aid})
        await db["article_versions"].insert_one(
            {
                "_id": vid,
                "article_id": aid,
                "version_no": 1,
                "status": "draft",
                "source_locale": "en",
                "translations": [
                    {"locale": "en", "revision_no": 2, "title": "EN", "body": "b"},
                    {"locale": "vi", "revision_no": 1, "title": "VI", "body": "b"},
                ],
            }
        )
        assert await migrate_single_locale(db) == 1
        v = await db["article_versions"].find_one({"_id": vid})
        assert v["title"] == "VI" and "translations" not in v
        assert await migrate_single_locale(db) == 0  # idempotent
        await client.close()

    asyncio.run(run())
