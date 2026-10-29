"""Tells phones that a new scan model is out (Expo push). Best effort: a failure here never
fails the publish, and the phone also finds the model by itself the next time it opens."""

import asyncio
import json
import logging
import urllib.request
from typing import Any, Protocol

log = logging.getLogger("durian.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH = 100


class PushSender(Protocol):
    async def send(self, messages: list[dict[str, Any]]) -> None: ...


class ExpoPushSender:
    """Posts to the Expo push service in batches of 100. Blocking I/O runs in a thread."""

    async def send(self, messages: list[dict[str, Any]]) -> None:
        for i in range(0, len(messages), BATCH):
            await asyncio.to_thread(self._post, messages[i : i + BATCH])

    @staticmethod
    def _post(batch: list[dict[str, Any]]) -> None:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(batch).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 (fixed https URL)
            resp.read()


_pending: set[asyncio.Task[None]] = set()


def message_for(doc: dict[str, Any], token: str) -> dict[str, Any]:
    entry = doc["entry"]
    part = entry["part_labels"]["vi"]
    return {
        "to": token,
        "title": f"Có mô hình mới cho {part}",
        "body": entry["release_notes"],
        "sound": "default",
        "data": {"type": "model_update", "plant_part": entry["plant_part"]},
    }


async def _send_all(state: Any, doc: dict[str, Any]) -> None:
    try:
        tokens = [t["_id"] async for t in state.db["push_tokens"].find({})]
        if tokens:
            await state.push_sender.send([message_for(doc, t) for t in tokens])
    except Exception:
        log.exception("model push failed")


async def notify_model_published(state: Any, doc: dict[str, Any]) -> None:
    """Fire and forget; keeps a reference so the task is not collected half way."""
    task = asyncio.create_task(_send_all(state, doc))
    _pending.add(task)
    task.add_done_callback(_pending.discard)
