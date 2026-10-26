import hashlib
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.media.storage import ObjectInfo

BYTES = b"\xff\xd8fake-jpeg"
SHA = hashlib.sha256(BYTES).hexdigest()
USER = {"X-Test-User": str(uuid.uuid4())}
OTHER = {"X-Test-User": str(uuid.uuid4())}


class FakeStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def presign_put(self, key: str, mime_type: str) -> str:
        return f"http://s3.test/put/{key}"

    async def presign_get(self, key: str) -> str:
        return f"http://s3.test/get/{key}"

    async def stat(self, key: str) -> ObjectInfo | None:
        b = self.objects.get(key)
        return None if b is None else ObjectInfo(len(b), hashlib.sha256(b).hexdigest())


@pytest.fixture
def store() -> FakeStore:
    return FakeStore()


@pytest.fixture
def media_api(replset_uri: str, store: FakeStore):
    from fastapi import Request

    from app.api.deps import CurrentUser, current_user

    settings = Settings(mongo_uri=replset_uri, mongo_db=f"t_{uuid.uuid4().hex[:12]}")
    app = create_app(settings, storage=store)

    async def fake_user(request: Request) -> CurrentUser:
        return CurrentUser(uuid.UUID(request.headers["x-test-user"]))

    app.dependency_overrides[current_user] = fake_user
    with TestClient(app) as c:
        yield c


def body(aid: str, **kw):
    return {
        "asset_id": aid,
        "mime_type": "image/jpeg",
        "size_bytes": len(BYTES),
        "sha256": SHA,
        **kw,
    }


def test_prepare_upload_complete_access(media_api, store):
    aid = str(uuid.uuid4())
    r = media_api.post("/v1/media/prepare", json=body(aid), headers=USER)
    assert r.status_code == 200, r.text
    assert r.json()["asset"]["status"] == "pending" and r.json()["upload_url"]
    key = r.json()["asset"]["object_key"]

    # Bytes not there yet: retryable.
    r = media_api.post("/v1/media/complete", json={"asset_id": aid}, headers=USER)
    assert r.status_code == 422 and r.json()["code"] == "upload_incomplete"

    store.objects[key] = BYTES
    r = media_api.post("/v1/media/complete", json={"asset_id": aid}, headers=USER)
    assert r.status_code == 200 and r.json()["status"] == "ready"
    again = media_api.post("/v1/media/complete", json={"asset_id": aid}, headers=USER)
    assert again.json()["revision"] == r.json()["revision"]

    r = media_api.post("/v1/media/prepare", json=body(aid), headers=USER)
    assert r.json()["upload_url"] is None and r.json()["asset"]["status"] == "ready"

    r = media_api.get(f"/v1/media/{aid}/access", headers=USER)
    assert r.status_code == 200 and r.json()["url"].startswith("http://s3.test/get/")
    assert media_api.get(f"/v1/media/{aid}/access", headers=OTHER).status_code == 404


def test_hash_mismatch_and_id_reuse(media_api, store):
    aid = str(uuid.uuid4())
    key = media_api.post("/v1/media/prepare", json=body(aid), headers=USER).json()["asset"][
        "object_key"
    ]
    store.objects[key] = b"x" * len(BYTES)
    r = media_api.post("/v1/media/complete", json={"asset_id": aid}, headers=USER)
    assert r.status_code == 422 and r.json()["code"] == "hash_mismatch"

    r = media_api.post("/v1/media/prepare", json=body(aid, sha256="0" * 64), headers=USER)
    assert r.status_code == 422 and r.json()["code"] == "validation_failed"
    # Another owner cannot probe the id.
    assert media_api.post("/v1/media/prepare", json=body(aid), headers=OTHER).status_code == 404
