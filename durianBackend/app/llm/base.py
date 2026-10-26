"""Provider interfaces. Swap the LLM by implementing these and registering in `factory.py`."""

from dataclasses import dataclass
from typing import Literal, Protocol


class LlmError(Exception):
    """Any provider failure (network, quota, safety block, empty reply). Maps to llm_unavailable."""


@dataclass(frozen=True)
class ChatTurn:
    role: Literal["user", "assistant"]
    text: str


class LlmClient(Protocol):
    name: str

    async def generate(self, system: str, turns: list[ChatTurn]) -> str: ...


class Embedder(Protocol):
    name: str  # "<provider>:<model>:<dim>"; stored on every chunk so an index never mixes models
    dimensions: int

    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...
