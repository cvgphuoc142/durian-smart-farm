"""Real MongoDB replica set (transactions need one). Skipped when docker is down."""

import shutil
import subprocess
import time
import uuid
from collections.abc import Iterator

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.api.deps import CurrentUser, current_user
from app.config import Settings
from app.main import create_app


def _docker_up() -> bool:
    if not shutil.which("docker"):
        return False
    return subprocess.run(["docker", "info"], capture_output=True).returncode == 0


@pytest.fixture(scope="session")
def replset_uri() -> Iterator[str]:
    if not _docker_up():
        pytest.skip("docker daemon not running")
    from testcontainers.core.container import DockerContainer
    from testcontainers.core.waiting_utils import wait_for_logs

    container = (
        DockerContainer("mongo:7")
        .with_command("--replSet rs0 --bind_ip_all")
        .with_exposed_ports(27017)
    )
    with container:
        wait_for_logs(container, "Waiting for connections")
        container.exec(
            [
                "mongosh",
                "--quiet",
                "--eval",
                "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})",
            ]
        )
        uri = (
            f"mongodb://{container.get_container_host_ip()}:"
            f"{container.get_exposed_port(27017)}/?directConnection=true"
        )
        probe = MongoClient(uri, serverSelectionTimeoutMS=5000)
        for _ in range(60):
            if probe.admin.command("hello").get("isWritablePrimary"):
                break
            time.sleep(0.5)
        probe.close()
        yield uri


@pytest.fixture
def api(replset_uri: str) -> Iterator[TestClient]:
    """App on a fresh database. Auth is faked: `X-Test-User: <uuid>` is the caller."""
    settings = Settings(mongo_uri=replset_uri, mongo_db=f"t_{uuid.uuid4().hex[:12]}")
    app = create_app(settings)

    async def fake_user(request: Request) -> CurrentUser:
        header = request.headers.get("x-test-user")
        if header is None:
            from app.api.errors import ApiError
            from app.domain.errors import ErrorCode

            raise ApiError(ErrorCode.unauthenticated)
        return CurrentUser(uuid.UUID(header))

    app.dependency_overrides[current_user] = fake_user
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_api(replset_uri: str) -> Iterator[TestClient]:
    """App on a fresh database with the REAL auth path (dev login tokens, no overrides)."""
    settings = Settings(mongo_uri=replset_uri, mongo_db=f"t_{uuid.uuid4().hex[:12]}", app_env="dev")
    with TestClient(create_app(settings)) as client:
        yield client
