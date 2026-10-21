"""Owner-scoped data access for household collections.

There is no row-level security in Mongo, so this module is the ownership boundary: every
query is built here and always carries `owner_id`. Handlers never touch a collection
directly. A row that is missing and a row that belongs to someone else look the same
(`None`), which becomes `not_found` / `parent_not_found` upstream.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pymongo import ASCENDING, ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.db.codecs import decode_decimals, encode_decimals
from app.repositories.specs import SPECS, EntitySpec

Doc = dict[str, Any]

# Collections that exist before their entities do (Phase 5); read-only lookups.
RAW_COLLECTIONS = frozenset({"disease_cases", "media_assets", "scans", "self_checks"})


def _encode(spec: EntitySpec, fields: Doc) -> Doc:
    out = encode_decimals(fields, spec.scales)
    for list_name, scales in spec.nested_scales.items():
        if list_name in out:
            out[list_name] = [encode_decimals(item, scales) for item in out[list_name]]
    return out


def _decode(spec: EntitySpec, doc: Doc) -> Doc:
    out = decode_decimals(doc, spec.scales)
    for list_name, scales in spec.nested_scales.items():
        if list_name in out:
            out[list_name] = [decode_decimals(item, scales) for item in out[list_name]]
    out["id"] = out.pop("_id")
    out.pop("owner_id", None)
    return out


class HouseholdRepo:
    def __init__(
        self,
        db: AsyncDatabase,  # type: ignore[type-arg]
        spec: EntitySpec,
        owner_id: UUID,
        session: AsyncClientSession | None = None,
    ) -> None:
        self.spec = spec
        self.owner_id = owner_id
        self.session = session
        self._coll = db[spec.collection]

    def _scope(self, flt: Doc | None = None) -> Doc:
        return {**(flt or {}), "owner_id": self.owner_id}

    async def get(self, id: UUID, *, include_deleted: bool = False) -> Doc | None:
        flt = self._scope({"_id": id})
        if not include_deleted:
            flt["deleted_at"] = None
        doc = await self._coll.find_one(flt, session=self.session)
        return _decode(self.spec, doc) if doc else None

    async def find_live(self, flt: Doc | None = None) -> list[Doc]:
        cursor = self._coll.find(
            self._scope({**(flt or {}), "deleted_at": None}), session=self.session
        )
        return [_decode(self.spec, d) async for d in cursor]

    async def exists_live(self, flt: Doc) -> bool:
        doc = await self._coll.find_one(
            self._scope({**flt, "deleted_at": None}), {"_id": 1}, session=self.session
        )
        return doc is not None

    async def all(self) -> list[Doc]:
        """Every row of the owner, tombstones included (snapshot)."""
        cursor = self._coll.find(self._scope(), session=self.session).sort(
            [("created_at", ASCENDING), ("_id", ASCENDING)]
        )
        return [_decode(self.spec, d) async for d in cursor]

    async def insert(self, doc: Doc) -> Doc:
        """Store a new row; returns it as stored (decimals at their canonical scale)."""
        stored = _encode(self.spec, doc)
        stored["_id"] = stored.pop("id")
        stored["owner_id"] = self.owner_id
        await self._coll.insert_one(stored, session=self.session)
        return _decode(self.spec, dict(stored))

    async def update(
        self, id: UUID, expected_revision: int, fields: Doc, now: datetime
    ) -> Doc | None:
        """Write `fields` if the row is live, ours and still at `expected_revision`.
        Returns the new row, or None when nothing matched (caller re-reads to classify)."""
        doc = await self._coll.find_one_and_update(
            self._scope({"_id": id, "revision": expected_revision, "deleted_at": None}),
            {"$set": {**_encode(self.spec, fields), "updated_at": now}, "$inc": {"revision": 1}},
            return_document=ReturnDocument.AFTER,
            session=self.session,
        )
        return _decode(self.spec, doc) if doc else None


class Repos:
    """The repositories for one owner, sharing one (optional) transaction session."""

    def __init__(
        self,
        db: AsyncDatabase,  # type: ignore[type-arg]
        owner_id: UUID,
        session: AsyncClientSession | None = None,
    ) -> None:
        self.db = db
        self.owner_id = owner_id
        self.session = session
        self._repos = {
            name: HouseholdRepo(db, spec, owner_id, session) for name, spec in SPECS.items()
        }

    def __getitem__(self, entity: str) -> HouseholdRepo:
        return self._repos[entity]

    async def raw_get_live(self, collection: str, id: UUID) -> Doc | None:
        """Owner-scoped read of a collection whose entity is not implemented yet."""
        assert collection in RAW_COLLECTIONS
        return await self.db[collection].find_one(
            {"_id": id, "owner_id": self.owner_id, "deleted_at": None}, session=self.session
        )

    async def raw_exists_live(self, collection: str, flt: Doc) -> bool:
        assert collection in RAW_COLLECTIONS
        doc = await self.db[collection].find_one(
            {**flt, "owner_id": self.owner_id, "deleted_at": None}, {"_id": 1}, session=self.session
        )
        return doc is not None
