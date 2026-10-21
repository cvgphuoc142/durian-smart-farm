"""The partial unique indexes are the race-proof backstop of the app-level checks."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db.indexes import INDEXES

pytestmark = pytest.mark.integration


@pytest.fixture
def db(replset_uri: str) -> Iterator[Database]:  # type: ignore[type-arg]
    client = MongoClient(replset_uri, uuidRepresentation="standard", tz_aware=True)
    database = client[f"t_idx_{uuid.uuid4().hex[:10]}"]
    for name, models in INDEXES.items():
        database[name].create_indexes(models)  # same specs the app applies at startup
    yield database
    client.drop_database(database.name)
    client.close()


def _doc(**fields: object) -> dict[str, object]:
    return {
        "_id": uuid.uuid4(),
        "owner_id": uuid.uuid4(),
        "deleted_at": None,
        "created_at": datetime.now(UTC),
        **fields,
    }


def test_plot_name_is_unique_among_live_plots_only(db: Database) -> None:  # type: ignore[type-arg]
    farm = uuid.uuid4()
    db.plots.insert_one(_doc(farm_id=farm, name="A"))
    with pytest.raises(DuplicateKeyError):
        db.plots.insert_one(_doc(farm_id=farm, name="A"))
    db.plots.insert_one(_doc(farm_id=uuid.uuid4(), name="A"))
    db.plots.insert_one(_doc(farm_id=farm, name="A", deleted_at=datetime.now(UTC)))
    db.plots.insert_one(
        _doc(farm_id=farm, name="A", deleted_at=datetime.now(UTC))
    )  # tombstones pile up
    db.plots.delete_one({"farm_id": farm, "name": "A", "deleted_at": None})
    db.plots.insert_one(_doc(farm_id=farm, name="A"))


def test_one_open_season_per_plot(db: Database) -> None:  # type: ignore[type-arg]
    plot = uuid.uuid4()
    db.seasons.insert_one(_doc(plot_id=plot, closed_on=None))
    with pytest.raises(DuplicateKeyError):
        db.seasons.insert_one(_doc(plot_id=plot, closed_on=None))
    db.seasons.insert_one(_doc(plot_id=plot, closed_on="2026-01-01"))
    db.seasons.insert_one(_doc(plot_id=plot, closed_on="2026-02-01"))
    db.seasons.insert_one(_doc(plot_id=plot, closed_on=None, deleted_at=datetime.now(UTC)))


def test_one_live_expense_per_care_log(db: Database) -> None:  # type: ignore[type-arg]
    log = uuid.uuid4()
    db.expenses.insert_one(_doc(care_log_id=log))
    with pytest.raises(DuplicateKeyError):
        db.expenses.insert_one(_doc(care_log_id=log))
    db.expenses.insert_one(_doc(care_log_id=None))  # unlinked expenses never collide
    db.expenses.insert_one(_doc(care_log_id=None))
    db.expenses.insert_one(_doc(care_log_id=log, deleted_at=datetime.now(UTC)))
