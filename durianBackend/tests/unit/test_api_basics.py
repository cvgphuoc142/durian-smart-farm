import uuid

from fastapi import APIRouter
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.api.errors import ApiError
from app.domain.errors import ErrorCode
from app.main import create_app


class Body(BaseModel):
    n: int


def _client() -> TestClient:
    from app.config import Settings

    app = create_app(
        Settings(mongo_uri="mongodb://127.0.0.1:1/", mongo_timeout_ms=200), bootstrap_indexes=False
    )
    r = APIRouter()

    @r.post("/t/body")
    async def body(b: Body) -> None: ...

    @r.get("/t/err")
    async def err() -> None:
        raise ApiError(ErrorCode.rate_limited, retry_after=7)

    @r.get("/t/boom")
    async def boom() -> None:
        raise RuntimeError("secret-stack-detail")

    app.include_router(r)
    return TestClient(app, raise_server_exceptions=False)


def test_healthz(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}


def test_readyz_503_when_mongo_down(client: TestClient) -> None:
    r = client.get("/readyz")
    assert r.status_code == 503
    assert r.json()["code"] == "service_unavailable"
    assert r.json()["retryable"] is True


def test_request_id_echoed_and_generated(client: TestClient) -> None:
    rid = str(uuid.uuid4())
    assert client.get("/healthz", headers={"X-Request-Id": rid}).headers["X-Request-Id"] == rid
    generated = client.get("/healthz", headers={"X-Request-Id": "junk"}).headers["X-Request-Id"]
    uuid.UUID(generated)


def test_not_found_shape(client: TestClient) -> None:
    r = client.get("/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"request_id", "code", "message", "retryable"}
    assert r.json()["code"] == "not_found"


def test_api_error_retry_after() -> None:
    r = _client().get("/t/err")
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "7"
    assert r.json()["code"] == "rate_limited" and r.json()["retryable"] is True


def test_validation_maps_to_catalog() -> None:
    c = _client()
    r = c.post("/t/body", json={})
    assert r.status_code == 422
    assert r.json()["code"] == "required" and r.json()["field"] == "n"
    r = c.post("/t/body", json={"n": "x"})
    assert r.json()["code"] == "invalid_format"


def test_unhandled_does_not_leak() -> None:
    r = _client().get("/t/boom")
    assert r.status_code == 503
    assert "secret-stack-detail" not in r.text
    assert r.json()["request_id"]
