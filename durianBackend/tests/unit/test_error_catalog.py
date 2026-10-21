import json
from pathlib import Path

from app.domain.errors import ERROR_META, ErrorCode

CONTRACT = Path(__file__).parents[2] / "contract" / "api_contract.json"


def test_enum_matches_contract() -> None:
    catalog = json.loads(CONTRACT.read_text())["x-errorCodes"]
    assert {c.value for c in ErrorCode} == set(catalog)
    for code, spec in catalog.items():
        assert ERROR_META[ErrorCode(code)] == (spec["http"], spec["retryable"])
