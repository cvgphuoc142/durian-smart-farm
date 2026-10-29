"""Scan models: admin uploads and publishes, the phone reads the manifest and downloads."""

import hashlib
import time
import uuid
from collections.abc import Iterator
from copy import deepcopy
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import Settings
from app.main import create_app
from app.media.storage import ObjectInfo
from tests.integration.test_identity import bearer, login

FILE = b"onnx-bytes" * 100
SHA = hashlib.sha256(FILE).hexdigest()


class FakeStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.ttls: list[int | None] = []

    async def presign_put(self, key: str, mime_type: str) -> str:
        return f"http://s3.test/put/{key}"

    async def presign_get(self, key: str, ttl_s: int | None = None) -> str:
        self.ttls.append(ttl_s)
        return f"http://s3.test/get/{key}"

    async def stat(self, key: str) -> ObjectInfo | None:
        b = self.objects.get(key)
        return None if b is None else ObjectInfo(len(b), hashlib.sha256(b).hexdigest())

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


class FakePush:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send(self, messages: list[dict[str, Any]]) -> None:
        self.sent.extend(messages)


def entry(part: str = "leaf", version: str = "v1", **kw: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "model_id": f"durianos_{part}",
        "version": version,
        "pipeline_version": "js-letterbox-1",
        "threshold_version": "energy-1",
        "plant_part": part,
        "part_labels": {"vi": "Lá" if part == "leaf" else "Quả", "en": part},
        "input": {
            "name": "image",
            "width": 224,
            "height": 224,
            "layout": "NCHW",
            "color": "RGB",
            "scale": 1 / 255,
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225],
            "resize": "letterbox",
            "pad": [124, 116, 104],
        },
        "output": {"name": "logits", "activation": "temperature_softmax", "temperature": 0.08},
        "classes": [
            {
                "index": 0,
                "kind": "disease",
                "disease_code": f"{part}__anthracnose",
                "labels": {"vi": "Thán thư"},
            },
            {"index": 1, "kind": "disease", "disease_code": f"{part}__canker", "labels": {}},
        ],
        "rules": {"suspected_min": 0.5, "healthy_min": 0.5},
        "release_notes": "Thêm nhãn mới",
        "maturity": "beta",
        "supports_healthy": False,
    }
    return base | kw


@pytest.fixture
def env(replset_uri: str) -> Iterator[tuple[TestClient, FakeStore, FakePush, dict[str, str]]]:
    store, push = FakeStore(), FakePush()
    settings = Settings(mongo_uri=replset_uri, mongo_db=f"t_{uuid.uuid4().hex[:12]}", app_env="dev")
    with TestClient(create_app(settings, storage=store, push_sender=push)) as c:
        s = login(c, "model-admin")
        mc: MongoClient[Any] = MongoClient(
            replset_uri, tz_aware=True, uuidRepresentation="standard"
        )
        mc[c.app.state.db.name]["admin_members"].insert_one({"user_id": uuid.UUID(s["user"]["id"])})
        mc.close()
        yield c, store, push, bearer(s)


def upload(
    c: TestClient, store: FakeStore, h: dict[str, str], e: dict[str, Any], data: bytes = FILE
) -> dict[str, Any]:
    r = c.post(
        "/v1/admin/models",
        json={"entry": e, "sha256": hashlib.sha256(data).hexdigest(), "size_bytes": len(data)},
        headers=h,
    )
    assert r.status_code == 201, r.text
    m = r.json()["model"]
    assert r.json()["upload_url"].startswith("http://s3.test/put/")
    store.objects[f"models/{m['id']}.onnx"] = data
    done = c.post(f"/v1/admin/models/{m['id']}/complete", headers=h)
    assert done.status_code == 200, done.text
    return done.json()  # type: ignore[no-any-return]


def act(c: TestClient, h: dict[str, str], mid: str, action: str) -> Any:
    return c.post(f"/v1/admin/models/{mid}/transition", json={"action": action}, headers=h)


def test_manifest_is_empty_until_something_is_published(env: Any) -> None:
    c, store, _, h = env
    m = c.get("/v1/models/manifest", headers=h).json()
    assert m["entries"] == [] and m["schema_version"] == 1
    upload(c, store, h, entry())  # a draft is not offered
    assert c.get("/v1/models/manifest", headers=h).json()["entries"] == []


def test_publish_download_and_replace(env: Any) -> None:
    c, store, push, h = env
    one = upload(c, store, h, entry(version="v1"))
    assert act(c, h, one["id"], "publish").status_code == 200
    manifest = c.get("/v1/models/manifest", headers=h).json()
    [e] = manifest["entries"]
    assert e["artifact"]["sha256"] == SHA and e["artifact"]["size_bytes"] == len(FILE)
    assert e["release_notes"] == "Thêm nhãn mới" and e["maturity"] == "beta"
    assert e["classes"][0]["disease_code"] == "leaf__anthracnose"
    assert "pad" in e["input"] and "margin_min" not in e["rules"]

    dl = c.get("/v1/models/durianos_leaf/v1/download", headers=h)
    assert dl.status_code == 200 and dl.json()["sha256"] == SHA
    assert store.ttls[-1] == 3600  # long enough for a slow farm connection

    # a second body part is added by publishing, nothing else
    fruit = upload(c, store, h, entry("fruit"))
    act(c, h, fruit["id"], "publish")
    parts = [x["plant_part"] for x in c.get("/v1/models/manifest", headers=h).json()["entries"]]
    assert parts == ["fruit", "leaf"]

    # a new leaf version replaces the old one; the old one is no longer downloadable
    two = upload(c, store, h, entry(version="v2"), b"newer" * 50)
    rev = c.get("/v1/models/manifest", headers=h).json()["revision"]
    act(c, h, two["id"], "publish")
    after = c.get("/v1/models/manifest", headers=h).json()
    assert after["revision"] != rev
    assert {x["version"] for x in after["entries"] if x["plant_part"] == "leaf"} == {"v2"}
    assert c.get("/v1/models/durianos_leaf/v1/download", headers=h).status_code == 404

    # publishing the old version again is the server-side rollback
    act(c, h, one["id"], "publish")
    again = c.get("/v1/models/manifest", headers=h).json()["entries"]
    assert {x["version"] for x in again if x["plant_part"] == "leaf"} == {"v1"}

    # the phones were told, once per publish with a token registered
    assert push.sent == []


def test_push_goes_to_registered_phones(env: Any) -> None:
    c, store, push, h = env
    r = c.put(
        "/v1/me/push-token",
        json={"token": "ExponentPushToken[abc]", "platform": "android"},
        headers=h,
    )
    assert r.status_code == 200
    m = upload(c, store, h, entry())
    act(c, h, m["id"], "publish")
    for _ in range(50):  # the push runs after the response
        if push.sent:
            break
        time.sleep(0.05)
    assert [x["to"] for x in push.sent] == ["ExponentPushToken[abc]"]
    assert push.sent[0]["title"] == "Có mô hình mới cho Lá"
    assert push.sent[0]["body"] == "Thêm nhãn mới"
    assert push.sent[0]["data"] == {"type": "model_update", "plant_part": "leaf"}
    assert c.delete("/v1/me/push-token?token=ExponentPushToken[abc]", headers=h).status_code == 200


def test_unpublish_removes_from_manifest_and_download(env: Any) -> None:
    c, store, _, h = env
    m = upload(c, store, h, entry())
    act(c, h, m["id"], "publish")
    assert act(c, h, m["id"], "unpublish").status_code == 200
    assert c.get("/v1/models/manifest", headers=h).json()["entries"] == []
    assert c.get("/v1/models/durianos_leaf/v1/download", headers=h).status_code == 404
    assert act(c, h, m["id"], "unpublish").json()["code"] == "invalid_transition"


def test_file_must_match_before_it_can_be_published(env: Any) -> None:
    c, store, _, h = env
    r = c.post(
        "/v1/admin/models",
        json={"entry": entry(), "sha256": SHA, "size_bytes": len(FILE)},
        headers=h,
    )
    mid = r.json()["model"]["id"]
    assert (
        c.post(f"/v1/admin/models/{mid}/complete", headers=h).json()["code"] == "upload_incomplete"
    )
    assert act(c, h, mid, "publish").json()["code"] == "upload_incomplete"
    store.objects[f"models/{mid}.onnx"] = b"x" * len(FILE)  # same size, other bytes
    assert c.post(f"/v1/admin/models/{mid}/complete", headers=h).json()["code"] == "hash_mismatch"
    store.objects[f"models/{mid}.onnx"] = FILE
    assert c.post(f"/v1/admin/models/{mid}/complete", headers=h).status_code == 200
    assert act(c, h, mid, "publish").status_code == 200


def test_entry_is_validated_like_the_phone_does(env: Any) -> None:
    c, _, _, h = env

    def post(e: dict[str, Any]) -> Any:
        return c.post(
            "/v1/admin/models",
            json={"entry": e, "sha256": SHA, "size_bytes": 1},
            headers=h,
        )

    assert post(entry(supports_healthy=True)).status_code == 422  # claims healthy, has no class
    bad = entry()
    bad["classes"][0]["disease_code"] = None
    assert post(bad).status_code == 422
    no_pad = deepcopy(entry())
    del no_pad["input"]["pad"]
    assert post(no_pad).status_code == 422
    assert post(entry(min_app_version="one")).status_code == 422
    assert post(entry(release_notes="")).status_code == 422
    healthy = entry(supports_healthy=True, maturity="stable")
    healthy["classes"].append({"index": 2, "kind": "healthy", "disease_code": None, "labels": {}})
    assert post(healthy).status_code == 201
    assert post(healthy).status_code == 422  # same model_id + version twice


def test_edit_notes_and_beta_without_a_new_file(env: Any) -> None:
    c, store, _, h = env
    m = upload(c, store, h, entry())
    act(c, h, m["id"], "publish")
    r = c.patch(
        f"/v1/admin/models/{m['id']}",
        json={"maturity": "stable", "limitations": "Chỉ lá sầu riêng", "min_app_version": "1.0.0"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    [e] = c.get("/v1/models/manifest", headers=h).json()["entries"]
    assert (e["maturity"], e["limitations"], e["min_app_version"]) == (
        "stable",
        "Chỉ lá sầu riêng",
        "1.0.0",
    )
    c.patch(f"/v1/admin/models/{m['id']}", json={"clear_limitations": True}, headers=h)
    [e] = c.get("/v1/models/manifest", headers=h).json()["entries"]
    assert "limitations" not in e


def test_only_admins_and_only_drafts_can_be_deleted(env: Any) -> None:
    c, store, _, h = env
    nobody = bearer(login(c, "farmer"))
    assert c.get("/v1/admin/models", headers=nobody).status_code == 403
    assert c.get("/v1/models/manifest", headers=nobody).status_code == 200  # farmers read it
    assert c.get("/v1/models/manifest").status_code == 401

    m = upload(c, store, h, entry())
    assert c.delete(f"/v1/admin/models/{m['id']}", headers=h).status_code == 204
    assert f"models/{m['id']}.onnx" not in store.objects
    m = upload(c, store, h, entry(version="v9"))
    act(c, h, m["id"], "publish")
    assert (
        c.delete(f"/v1/admin/models/{m['id']}", headers=h).json()["code"] == "published_immutable"
    )
    listed = c.get("/v1/admin/models", headers=h).json()["items"]
    assert [x["entry"]["version"] for x in listed] == ["v9"]
