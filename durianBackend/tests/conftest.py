import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    # No Mongo needed: unit tests never touch the database (short timeout, no index bootstrap).
    settings = Settings(mongo_uri="mongodb://127.0.0.1:1/", mongo_timeout_ms=200)
    with TestClient(create_app(settings, bootstrap_indexes=False)) as c:
        yield c
