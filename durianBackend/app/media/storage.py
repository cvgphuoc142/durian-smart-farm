"""Private object storage behind a small protocol. boto3 is blocking, so calls run in threads."""

import asyncio
import hashlib
from dataclasses import dataclass
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.client import Config  # type: ignore[import-untyped]
from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-untyped]

from app.config import Settings


class StorageError(Exception):
    """The storage backend is unreachable or misbehaving (maps to service_unavailable)."""


@dataclass(frozen=True)
class ObjectInfo:
    size: int
    sha256: str


class ObjectStore(Protocol):
    async def presign_put(self, key: str, mime_type: str) -> str: ...
    async def presign_get(self, key: str, ttl_s: int | None = None) -> str: ...
    async def stat(self, key: str) -> ObjectInfo | None:
        """Size and sha256 of the stored bytes; None when the object does not exist."""
        ...

    async def delete(self, key: str) -> None: ...


class S3Store:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.s3_bucket
        self._ttl = settings.media_url_ttl_s
        cfg = Config(signature_version="s3v4", s3={"addressing_style": "path"})

        def make(url: str):  # type: ignore[no-untyped-def]
            return boto3.client(
                "s3",
                endpoint_url=url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                config=cfg,
            )

        self._internal = make(settings.s3_endpoint_url)
        # Signing is offline, so the public client never needs to reach the host it signs for.
        self._public = make(settings.s3_public_endpoint_url or settings.s3_endpoint_url)

    async def ensure_bucket(self) -> None:
        def run() -> None:
            try:
                self._internal.head_bucket(Bucket=self._bucket)
            except ClientError:
                self._internal.create_bucket(Bucket=self._bucket)

        await asyncio.to_thread(run)

    async def presign_put(self, key: str, mime_type: str) -> str:
        return self._public.generate_presigned_url(  # type: ignore[no-any-return]
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": mime_type},
            ExpiresIn=self._ttl,
        )

    async def presign_get(self, key: str, ttl_s: int | None = None) -> str:
        return self._public.generate_presigned_url(  # type: ignore[no-any-return]
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=ttl_s or self._ttl,
        )

    async def upload_file(self, key: str, path: str) -> None:
        """Server-side upload of a local file (operator scripts; phones use presigned PUTs)."""
        await asyncio.to_thread(self._internal.upload_file, path, self._bucket, key)

    async def delete(self, key: str) -> None:
        try:
            await asyncio.to_thread(self._internal.delete_object, Bucket=self._bucket, Key=key)
        except (BotoCoreError, ClientError) as e:
            raise StorageError(str(e)) from e

    async def stat(self, key: str) -> ObjectInfo | None:
        def run() -> ObjectInfo | None:
            try:
                body = self._internal.get_object(Bucket=self._bucket, Key=key)["Body"]
            except ClientError as e:
                if e.response.get("Error", {}).get("Code") in ("NoSuchKey", "404", "NotFound"):
                    return None
                raise
            h = hashlib.sha256()
            size = 0
            for chunk in body.iter_chunks(1 << 20):
                h.update(chunk)
                size += len(chunk)
            return ObjectInfo(size, h.hexdigest())

        try:
            return await asyncio.to_thread(run)
        except (BotoCoreError, ClientError) as e:
            raise StorageError(str(e)) from e
