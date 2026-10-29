"""Publish scan models from a manifest file and a folder of .onnx files (no admin UI needed).

    uv run python -m scripts.publish_models ../durianMobile/assets/models/manifest.json \
        --files ../durianMobile/assets/models --maturity beta \
        --notes "Mô hình nhận diện bệnh, bản đầu tiên" --publish

The manifest is the app's own format (`entries[].artifact.path` names the file next to it).
Entries that already exist (same model_id and version) are skipped, so it is safe to re-run.
Without --publish the versions stay drafts for the admin page.
"""

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.content.workflow import new_id
from app.db.client import get_db, make_client
from app.db.indexes import ensure_indexes
from app.media.storage import S3Store
from app.scan_models import registry
from app.scan_models.schema import ModelEntryBody
from app.sync.receipts import utcnow_ms


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


async def main(manifest: Path, files: Path, maturity: str, notes: str, publish: bool) -> int:
    settings = get_settings()
    client = make_client(settings)
    db = get_db(client, settings)
    store = S3Store(settings)
    try:
        await ensure_indexes(db)
        await store.ensure_bucket()
        raw: list[dict[str, Any]] = json.loads(manifest.read_text())["entries"]
        for item in raw:
            art = item.pop("artifact")
            path = files / art["path"]
            if not path.is_file():
                print(f"missing file {path}", file=sys.stderr)
                return 1
            digest = sha256_of(path)
            if digest != art["sha256"]:
                print(f"{path.name}: sha256 differs from the manifest", file=sys.stderr)
                return 1
            has_healthy = any(c["kind"] == "healthy" for c in item["classes"])
            body = ModelEntryBody.model_validate(
                {
                    **item,
                    "release_notes": item.get("release_notes", notes),
                    "maturity": item.get("maturity", maturity),
                    "supports_healthy": item.get("supports_healthy", has_healthy),
                }
            )
            e = body.to_wire()
            if await db[registry.COLLECTION].find_one(
                {"entry.model_id": e["model_id"], "entry.version": e["version"]}
            ):
                print(f"{e['model_id']} {e['version'][:8]}: already registered, skipped")
                continue
            vid = new_id()
            key = registry.object_key(vid)
            await store.upload_file(key, str(path))
            now = utcnow_ms()
            doc = {
                "_id": vid,
                "entry": e,
                "artifact": {
                    "key": key,
                    "sha256": digest,
                    "size_bytes": path.stat().st_size,
                    "status": "ready",
                },
                "status": "draft",
                "created_at": now,
                "updated_at": now,
                "published_at": None,
            }
            await db[registry.COLLECTION].insert_one(doc)
            if publish:
                await registry.publish(db, doc)
            print(f"{e['model_id']} {e['version'][:8]}: {'published' if publish else 'draft'}")
        return 0
    finally:
        await client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("manifest", type=Path)
    ap.add_argument("--files", type=Path, required=True, help="folder with the .onnx files")
    ap.add_argument("--maturity", choices=["stable", "beta"], default="beta")
    ap.add_argument("--notes", default="Mô hình nhận diện mới", help="release notes (Vietnamese)")
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    sys.exit(asyncio.run(main(a.manifest, a.files, a.maturity, a.notes, a.publish)))
