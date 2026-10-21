import uuid
from typing import Any

from fastapi.testclient import TestClient


def uid() -> str:
    return str(uuid.uuid4())


def upsert(entity: str, id: str, data: dict[str, Any], rev: int | None = None) -> dict[str, Any]:
    return {"entity": entity, "op": "upsert", "id": id, "expected_revision": rev, "data": data}


def delete(entity: str, id: str, rev: int) -> dict[str, Any]:
    return {"entity": entity, "op": "delete", "id": id, "expected_revision": rev}


def mutation(*ops: dict[str, Any], id: str | None = None) -> dict[str, Any]:
    return {"mutation_id": id or uid(), "ops": list(ops)}


class Farmer:
    """One signed-in household talking to the API."""

    def __init__(self, client: TestClient, user: str | None = None) -> None:
        self.client = client
        self.user = user or uid()

    def post(self, *mutations: dict[str, Any]) -> list[dict[str, Any]]:
        r = self.client.post(
            "/v1/sync", json={"mutations": list(mutations)}, headers={"x-test-user": self.user}
        )
        assert r.status_code == 200, r.text
        results: list[dict[str, Any]] = r.json()["results"]
        assert len(results) == len(mutations)
        return results

    def one(self, *ops: dict[str, Any], id: str | None = None) -> dict[str, Any]:
        return self.post(mutation(*ops, id=id))[0]

    def ok(self, *ops: dict[str, Any]) -> dict[str, Any]:
        result = self.one(*ops)
        assert result["status"] == "applied", result
        return result

    def snapshot(self) -> dict[str, Any]:
        r = self.client.get("/v1/snapshot", headers={"x-test-user": self.user})
        assert r.status_code == 200, r.text
        body: dict[str, Any] = r.json()
        return body

    def rows(self, result: dict[str, Any]) -> list[dict[str, Any]]:
        return [x["row"] for x in result["rows"]]


def rejected(result: dict[str, Any], code: str, field: str | None = None) -> None:
    assert result["status"] == "rejected", result
    assert result["code"] == code, result
    if field is not None:
        assert result["field"] == field, result


FARM = {"name": "Vườn Sáu Riêng"}


def setup_garden(f: Farmer) -> dict[str, str]:
    """farm -> plot -> season (open), each its own mutation, as the app's setup flow does."""
    ids = {"farm": uid(), "plot": uid(), "season": uid()}
    f.ok(upsert("farm", ids["farm"], FARM))
    f.ok(upsert("plot", ids["plot"], {"farm_id": ids["farm"], "name": "Lô A"}))
    f.ok(
        upsert(
            "season",
            ids["season"],
            {
                "plot_id": ids["plot"],
                "name": "Vụ 2026",
                "started_on": "2026-03-01",
                "stage": "recovery",
            },
        )
    )
    return ids
