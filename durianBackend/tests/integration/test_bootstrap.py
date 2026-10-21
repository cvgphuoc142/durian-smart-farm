"""Needs docker. Skipped automatically when the daemon is down."""

import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

pytestmark = pytest.mark.integration


def _docker_up() -> bool:
    if not shutil.which("docker"):
        return False
    return subprocess.run(["docker", "info"], capture_output=True).returncode == 0


@pytest.fixture(scope="module")
def mongo_uri():
    if not _docker_up():
        pytest.skip("docker daemon not running")
    from testcontainers.mongodb import MongoDbContainer

    with MongoDbContainer("mongo:7") as m:
        yield m.get_connection_url()


def test_readyz_and_idempotent_indexes(mongo_uri: str) -> None:
    settings = Settings(mongo_uri=mongo_uri, mongo_db="t_bootstrap")
    for _ in range(2):  # second boot must not fail: bootstrap is idempotent
        with TestClient(create_app(settings)) as c:
            assert c.get("/readyz").json() == {"status": "ready"}
