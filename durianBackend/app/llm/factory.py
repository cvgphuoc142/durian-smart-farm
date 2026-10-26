"""Provider registry. To add one: write a class pair in app/llm/<name>.py, add a branch here
and set LLM_PROVIDER / EMBEDDING_PROVIDER."""

from app.config import Settings
from app.llm.base import Embedder, LlmClient


def build_llm(settings: Settings) -> LlmClient | None:
    """None when the provider is unconfigured; chat then answers llm_unavailable."""
    match settings.llm_provider:
        case "gemini":
            if not settings.gemini_api_key:
                return None
            from app.llm.gemini import GeminiLlm

            return GeminiLlm(settings)
        case other:
            raise ValueError(f"unknown LLM_PROVIDER {other!r}")


def build_embedder(settings: Settings) -> Embedder | None:
    match settings.embedding_provider or settings.llm_provider:
        case "gemini":
            if not settings.gemini_api_key:
                return None
            from app.llm.gemini import GeminiEmbedder

            return GeminiEmbedder(settings)
        case other:
            raise ValueError(f"unknown EMBEDDING_PROVIDER {other!r}")
