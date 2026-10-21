from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Request
from pymongo.asynchronous.database import AsyncDatabase

from app.api.deps import CurrentUser, current_user, get_database
from app.repositories.household import Repos
from app.schemas.sync import Snapshot, SyncRequest, SyncResponse
from app.sync.engine import apply_mutations
from app.sync.receipts import utcnow_ms

router = APIRouter(prefix="/v1", tags=["Household data"])

_FARM_ID = "aaaaaaaa-0000-4000-8000-000000000001"
_PLOT_ID = "aaaaaaaa-0000-4000-8000-000000000002"
EXAMPLES = {
    "create_farm": {
        "summary": "Create a farm (expected_revision null = create)",
        "value": {
            "mutations": [
                {
                    "mutation_id": "bbbbbbbb-0000-4000-8000-000000000001",
                    "ops": [
                        {
                            "entity": "farm",
                            "op": "upsert",
                            "id": _FARM_ID,
                            "expected_revision": None,
                            "data": {"name": "Vườn thử Swagger", "province": "Tiền Giang"},
                        }
                    ],
                }
            ]
        },
    },
    "create_plot": {
        "summary": "Create a plot under the farm above",
        "value": {
            "mutations": [
                {
                    "mutation_id": "bbbbbbbb-0000-4000-8000-000000000002",
                    "ops": [
                        {
                            "entity": "plot",
                            "op": "upsert",
                            "id": _PLOT_ID,
                            "expected_revision": None,
                            "data": {"farm_id": _FARM_ID, "name": "Lô 1", "area_ha": "1.2"},
                        }
                    ],
                }
            ]
        },
    },
    "update_farm": {
        "summary": "Update farm (send the revision you last saw; wrong rev => conflict)",
        "value": {
            "mutations": [
                {
                    "mutation_id": "bbbbbbbb-0000-4000-8000-000000000003",
                    "ops": [
                        {
                            "entity": "farm",
                            "op": "upsert",
                            "id": _FARM_ID,
                            "expected_revision": 1,
                            "data": {"name": "Vườn đã đổi tên"},
                        }
                    ],
                }
            ]
        },
    },
    "delete_plot": {
        "summary": "Soft-delete (tombstone) a plot",
        "value": {
            "mutations": [
                {
                    "mutation_id": "bbbbbbbb-0000-4000-8000-000000000004",
                    "ops": [
                        {"entity": "plot", "op": "delete", "id": _PLOT_ID, "expected_revision": 1}
                    ],
                }
            ]
        },
    },
}


@router.post("/sync", response_model=SyncResponse, operation_id="sync")
async def sync(
    body: Annotated[SyncRequest, Body(openapi_examples=EXAMPLES)],
    request: Request,
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    results = await apply_mutations(request.app.state.client, db, user.id, body.mutations)
    return {"results": results}


@router.get("/snapshot", response_model=Snapshot, operation_id="getSnapshot")
async def snapshot(
    user: Annotated[CurrentUser, Depends(current_user)],
    db: Annotated[AsyncDatabase, Depends(get_database)],  # type: ignore[type-arg]
) -> dict[str, Any]:
    """Everything the caller has had acknowledged, tombstones included."""
    repos = Repos(db, user.id)
    as_of = utcnow_ms()  # taken first: a write racing the reads shows up in the next snapshot
    return {
        "as_of": as_of,
        "farms": await repos["farm"].all(),
        "plots": await repos["plot"].all(),
        "seasons": await repos["season"].all(),
        "care_logs": await repos["care_log"].all(),
        "expenses": await repos["expense"].all(),
        "sales": await repos["sale"].all(),
        "sale_payments": await repos["sale_payment"].all(),
    }
