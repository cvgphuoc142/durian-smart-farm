import uuid

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from tests.integration.helpers import upsert

pytestmark = pytest.mark.integration


def login(c: TestClient, subject: str = "alice", provider: str = "google") -> dict:
    r = c.post("/v1/auth/session", json={"provider": provider, "id_token": f"dev:{subject}:Alice"})
    assert r.status_code == 200, r.text
    return r.json()


def bearer(session: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['token']}"}


def test_login_creates_user_and_me_works(auth_api: TestClient) -> None:
    s = login(auth_api)
    assert s["user"]["provider"] == "google" and s["user"]["display_name"] == "Alice"
    me = auth_api.get("/v1/me", headers=bearer(s)).json()
    assert me["user"] == s["user"]
    assert me["preferences"] == {
        "locale": "vi",
        "ai_consent_version": None,
        "ai_consented_at": None,
    }


def test_same_subject_same_user_providers_never_merge(auth_api: TestClient) -> None:
    a1, a2 = login(auth_api, "x"), login(auth_api, "x")
    apple = login(auth_api, "x", "apple")
    assert a1["user"]["id"] == a2["user"]["id"]
    assert a1["token"] != a2["token"]
    assert apple["user"]["id"] != a1["user"]["id"]


def test_missing_bad_token_is_401(auth_api: TestClient) -> None:
    assert auth_api.get("/v1/me").status_code == 401
    r = auth_api.get("/v1/me", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401 and r.json()["code"] == "unauthenticated"


def test_real_provider_token_rejected_without_client_ids(auth_api: TestClient) -> None:
    r = auth_api.post("/v1/auth/session", json={"provider": "google", "id_token": "a.b.c"})
    assert r.status_code == 401 and r.json()["code"] == "invalid_provider_token"
    assert (
        auth_api.post("/v1/auth/session", json={"provider": "x", "id_token": "t"}).status_code
        == 422
    )


def test_locale_and_consent(auth_api: TestClient) -> None:
    h = bearer(login(auth_api))
    assert auth_api.put("/v1/me/locale", json={"locale": "en"}, headers=h).json()["locale"] == "en"
    assert auth_api.put("/v1/me/locale", json={"locale": "fr"}, headers=h).status_code == 422
    p = auth_api.put("/v1/me/ai-consent", json={"version": 1}, headers=h).json()
    assert p["ai_consent_version"] == 1 and p["ai_consented_at"].endswith("Z")
    p = auth_api.put("/v1/me/ai-consent", json={"version": None}, headers=h).json()
    assert p["ai_consent_version"] is None and p["ai_consented_at"] is None
    assert auth_api.put("/v1/me/ai-consent", json={"version": 0}, headers=h).status_code == 422


def test_logout_revokes_only_that_session(auth_api: TestClient) -> None:
    s1, s2 = login(auth_api), login(auth_api)
    assert auth_api.post("/v1/auth/logout", headers=bearer(s1)).status_code == 204
    assert auth_api.get("/v1/me", headers=bearer(s1)).status_code == 401
    assert auth_api.get("/v1/me", headers=bearer(s2)).status_code == 200


def test_expired_session_is_401(auth_api: TestClient, replset_uri: str) -> None:
    s = login(auth_api)
    db_name = auth_api.app.state.db.name  # type: ignore[attr-defined]
    mc = MongoClient(replset_uri, tz_aware=True, uuidRepresentation="standard")
    mc[db_name]["sessions"].update_many(
        {}, [{"$set": {"expires_at": {"$subtract": ["$created_at", 1000]}}}]
    )
    mc.close()
    assert auth_api.get("/v1/me", headers=bearer(s)).status_code == 401


def test_households_isolated_with_real_tokens(auth_api: TestClient) -> None:
    a, b = bearer(login(auth_api, "a")), bearer(login(auth_api, "b"))
    fid = str(uuid.uuid4())
    body = {
        "mutations": [
            {"mutation_id": str(uuid.uuid4()), "ops": [upsert("farm", fid, {"name": "A"})]}
        ]
    }
    assert (
        auth_api.post("/v1/sync", json=body, headers=a).json()["results"][0]["status"] == "applied"
    )
    assert len(auth_api.get("/v1/snapshot", headers=a).json()["farms"]) == 1
    assert auth_api.get("/v1/snapshot", headers=b).json()["farms"] == []


def test_delete_account_erases_everything(auth_api: TestClient) -> None:
    s = login(auth_api, "gone")
    h = bearer(s)
    fid = str(uuid.uuid4())
    body = {
        "mutations": [
            {"mutation_id": str(uuid.uuid4()), "ops": [upsert("farm", fid, {"name": "A"})]}
        ]
    }
    auth_api.post("/v1/sync", json=body, headers=h)
    r = auth_api.delete("/v1/me", headers=h)
    assert r.status_code == 200
    assert r.json() == {"status": "deleted", "session_revoked": True, "media_pending": 0}
    assert auth_api.get("/v1/me", headers=h).status_code == 401
    again = login(auth_api, "gone")  # same provider subject signs up fresh
    assert again["user"]["id"] != s["user"]["id"]
    assert auth_api.get("/v1/snapshot", headers=bearer(again)).json()["farms"] == []


def test_admin_guard(auth_api: TestClient, replset_uri: str) -> None:
    s = login(auth_api, "boss")
    h = bearer(s)
    r = auth_api.get("/v1/admin/me", headers=h)
    assert r.status_code == 403 and r.json()["code"] == "admin_required"
    mc = MongoClient(replset_uri, tz_aware=True, uuidRepresentation="standard")
    mc[auth_api.app.state.db.name]["admin_members"].insert_one(  # type: ignore[attr-defined]
        {"user_id": uuid.UUID(s["user"]["id"])}
    )
    mc.close()
    assert auth_api.get("/v1/admin/me", headers=h).json()["is_admin"] is True
    assert auth_api.get("/v1/admin/me").status_code == 401
