.PHONY: storage dev seed reseed openapi up down lint typecheck test check
dev:       ; uv run uvicorn app.main:app --reload
seed:      ; uv run python -m scripts.seed
reseed:    ; uv run python -m scripts.seed --reset
openapi:   ; uv run python -c "import json;from app.main import app;print(json.dumps(app.openapi(),indent=2,ensure_ascii=False))" > openapi.json
up:        ; docker compose up -d mongo qdrant
storage:   ; docker compose --profile storage up -d minio
down:      ; docker compose down
lint:      ; uv run ruff check . && uv run ruff format --check .
typecheck: ; uv run mypy app
test:      ; uv run pytest
check: lint typecheck test
