"""Users, sessions and preferences. A session token is opaque: only its sha256 is stored,
and logging out (or deleting the account) deletes the row, which revokes it at once."""

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.auth.providers import Identity
from app.sync.receipts import utcnow_ms


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def upsert_user(db: AsyncDatabase, ident: Identity) -> dict[str, Any]:  # type: ignore[type-arg]
    key = {"provider": ident.provider, "subject": ident.subject}
    insert = {
        "_id": uuid.uuid4(),
        "locale": "vi",
        "ai_consent_version": None,
        "ai_consented_at": None,
        "created_at": utcnow_ms(),
    }
    for _ in range(2):  # a concurrent first login can lose the unique-index race once
        try:
            user = await db["users"].find_one_and_update(
                key,
                {"$setOnInsert": insert, "$set": {"last_login_at": utcnow_ms()}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            assert user is not None
            if ident.display_name and user.get("display_name") != ident.display_name:
                await db["users"].update_one(
                    {"_id": user["_id"]}, {"$set": {"display_name": ident.display_name}}
                )
                user["display_name"] = ident.display_name
            return dict(user)
        except DuplicateKeyError:
            continue
    raise RuntimeError("user upsert race did not settle")


async def create_session(
    db: AsyncDatabase,  # type: ignore[type-arg]
    user_id: UUID,
    ttl_days: int,
) -> str:
    token = secrets.token_urlsafe(32)
    now = utcnow_ms()
    await db["sessions"].insert_one(
        {
            "_id": uuid.uuid4(),
            "user_id": user_id,
            "token_hash": hash_token(token),
            "created_at": now,
            "expires_at": now + timedelta(days=ttl_days),
        }
    )
    return token


async def user_for_token(
    db: AsyncDatabase,  # type: ignore[type-arg]
    token: str,
) -> dict[str, Any] | None:
    session = await db["sessions"].find_one({"token_hash": hash_token(token)})
    if session is None or session["expires_at"] <= utcnow_ms():
        return None  # the TTL index lags up to a minute, so check expiry here too
    user: dict[str, Any] | None = await db["users"].find_one({"_id": session["user_id"]})
    return user


async def revoke_session(db: AsyncDatabase, token: str) -> None:  # type: ignore[type-arg]
    await db["sessions"].delete_one({"token_hash": hash_token(token)})


def user_wire(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "provider": user["provider"],
        "display_name": user.get("display_name"),
    }


def preferences_wire(user: dict[str, Any]) -> dict[str, Any]:
    at: datetime | None = user.get("ai_consented_at")
    return {
        "locale": user.get("locale", "vi"),
        "ai_consent_version": user.get("ai_consent_version"),
        "ai_consented_at": at.isoformat().replace("+00:00", "Z") if at else None,
    }


# ---- admin username / password (scrypt, stdlib only) ----
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **_SCRYPT)
    except ValueError:
        return False
    return hmac.compare_digest(actual, bytes.fromhex(digest))


async def user_for_credentials(
    db: AsyncDatabase,  # type: ignore[type-arg]
    username: str,
    password: str,
) -> dict[str, Any] | None:
    """The user behind a correct username + password, else None (same cost either way)."""
    cred = await db["admin_credentials"].find_one({"username": username})
    stored = cred["password_hash"] if cred else hash_password("x")
    ok = verify_password(password, stored)
    if cred is None or not ok:
        return None
    user: dict[str, Any] | None = await db["users"].find_one({"_id": cred["user_id"]})
    return user
