import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.llm.base import ChatTurn, LlmError
from app.main import create_app
from app.rag.store import Hit

VID = str(uuid.uuid4())
AID = str(uuid.uuid4())


def _hit(score: float) -> Hit:
    return Hit(AID, VID, 1, "Bệnh nấm", "Phun thuốc đúng liều.", score)


class FakeRetriever:
    def __init__(self) -> None:
        self.hits = [_hit(0.9)]

    async def search(self, query: str, k: int) -> list[Hit]:
        return self.hits


class FakeLlm:
    name = "fake"
    fail = False
    seen: list[ChatTurn] = []

    async def generate(self, system: str, turns: list[ChatTurn]) -> str:
        if self.fail:
            raise LlmError("boom")
        FakeLlm.seen = turns
        return "Phun đúng liều [1]."


@pytest.fixture
def ctx(replset_uri: str) -> Iterator[tuple[TestClient, FakeRetriever, FakeLlm]]:
    settings = Settings(
        mongo_uri=replset_uri,
        mongo_db=f"t_{uuid.uuid4().hex[:12]}",
        app_env="dev",
        chat_rate_limit_per_min=3,
    )
    retriever, llm = FakeRetriever(), FakeLlm()
    app = create_app(settings, llm=llm, retriever=retriever)
    with TestClient(app) as client:
        token = client.post(
            "/v1/auth/session", json={"provider": "google", "id_token": "dev:chat"}
        ).json()["token"]
        client.headers["Authorization"] = f"Bearer {token}"
        yield client, retriever, llm


def _body(**kw: object) -> dict[str, object]:
    return {
        "question": "Phun thuốc thế nào?",
        "locale": "vi",
        "history": [],
        "client_last_synced_at": None,
        **kw,
    }


def _consent(client: TestClient) -> None:
    assert client.put("/v1/me/ai-consent", json={"version": 1}).status_code == 200


def test_consent_required_first(ctx: tuple[TestClient, FakeRetriever, FakeLlm]) -> None:
    client, _, _ = ctx
    r = client.post("/v1/chat", json=_body())
    assert r.status_code == 403 and r.json()["code"] == "ai_consent_required"


def test_grounded_answer_cites_source(ctx: tuple[TestClient, FakeRetriever, FakeLlm]) -> None:
    client, _, _ = ctx
    _consent(client)
    r = client.post("/v1/chat", json=_body())
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "answered" and body["context_as_of"] is None
    assert body["citations"][0]["version_id"] == VID


def test_low_score_is_insufficient_without_llm_call(
    ctx: tuple[TestClient, FakeRetriever, FakeLlm],
) -> None:
    client, retriever, llm = ctx
    _consent(client)
    retriever.hits = [_hit(0.2)]
    llm.fail = True  # would 503 if it were called
    body = client.post("/v1/chat", json=_body()).json()
    assert body["status"] == "insufficient_sources"
    assert body["citations"][0]["article_id"] == AID


def test_llm_failure_maps_to_llm_unavailable(
    ctx: tuple[TestClient, FakeRetriever, FakeLlm],
) -> None:
    client, _, llm = ctx
    _consent(client)
    llm.fail = True
    r = client.post("/v1/chat", json=_body())
    assert r.status_code == 503 and r.json()["code"] == "llm_unavailable"


def test_foreign_season_is_not_found(ctx: tuple[TestClient, FakeRetriever, FakeLlm]) -> None:
    client, _, _ = ctx
    _consent(client)
    r = client.post("/v1/chat", json=_body(season_id=str(uuid.uuid4())))
    assert r.status_code == 404


def test_rate_limited(ctx: tuple[TestClient, FakeRetriever, FakeLlm]) -> None:
    client, _, _ = ctx
    _consent(client)
    codes = [client.post("/v1/chat", json=_body()).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_report_is_idempotent(ctx: tuple[TestClient, FakeRetriever, FakeLlm]) -> None:
    client, _, _ = ctx
    key = {"Idempotency-Key": str(uuid.uuid4())}
    body = {"question": "q", "answer": "a", "citations": [], "reason": None}
    a = client.post("/v1/chat/reports", json=body, headers=key)
    b = client.post("/v1/chat/reports", json=body, headers=key)
    assert a.status_code == 201 and a.json() == b.json()
