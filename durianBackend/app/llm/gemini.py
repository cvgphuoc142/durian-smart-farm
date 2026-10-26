import asyncio

from google import genai
from google.genai import types

from app.config import Settings
from app.llm.base import ChatTurn, LlmError

_BATCH = 100  # embed_content accepts up to 100 inputs per call


class GeminiLlm:
    name = "gemini"

    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_chat_model
        self._timeout = settings.llm_timeout_s

    async def generate(self, system: str, turns: list[ChatTurn]) -> str:
        contents = [
            types.Content(
                role="user" if t.role == "user" else "model", parts=[types.Part(text=t.text)]
            )
            for t in turns
        ]
        try:
            async with asyncio.timeout(self._timeout):
                resp = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=contents,
                    config=types.GenerateContentConfig(system_instruction=system, temperature=0.2),
                )
        except Exception as exc:  # SDK raises many types; callers only need "unavailable"
            raise LlmError(str(exc)) from exc
        if not resp.text:
            raise LlmError("empty response")
        return resp.text


class GeminiEmbedder:
    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_embedding_model
        self._timeout = settings.llm_timeout_s
        self.dimensions = settings.embedding_dim
        self.name = f"gemini:{self._model}:{self.dimensions}"

    async def _embed(self, texts: list[str], task: str) -> list[list[float]]:
        out: list[list[float]] = []
        try:
            async with asyncio.timeout(self._timeout * 2):
                for i in range(0, len(texts), _BATCH):
                    resp = await self._client.aio.models.embed_content(
                        model=self._model,
                        contents=texts[i : i + _BATCH],
                        config=types.EmbedContentConfig(
                            task_type=task, output_dimensionality=self.dimensions
                        ),
                    )
                    out += [list(e.values or []) for e in resp.embeddings or []]
        except Exception as exc:
            raise LlmError(str(exc)) from exc
        if len(out) != len(texts) or any(len(v) != self.dimensions for v in out):
            raise LlmError("unexpected embedding shape")
        return out

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT") if texts else []

    async def embed_query(self, text: str) -> list[float]:
        return (await self._embed([text], "RETRIEVAL_QUERY"))[0]
