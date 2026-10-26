from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "dev" enables the `dev:<subject>` login token (Swagger/seed). Anything else disables it.
    app_env: str = "prod"
    mongo_uri: str = "mongodb://localhost:27017/?directConnection=true"
    mongo_db: str = "durian"
    mongo_timeout_ms: int = 3000
    # OAuth client IDs accepted as the id_token `aud` (JSON list in the env var).
    google_client_ids: list[str] = []
    apple_client_ids: list[str] = []  # iOS bundle id(s) / Services id
    session_ttl_days: int = 30

    # --- Media storage (S3 API; MinIO in dev). Photos stay private, only presigned URLs leave.
    s3_endpoint_url: str = "http://localhost:9000"
    # Host the PHONE can reach, baked into presigned URLs. Empty = same as s3_endpoint_url.
    s3_public_endpoint_url: str = ""
    s3_bucket: str = "durian-media"
    s3_access_key: str = "durian"
    s3_secret_key: str = "durian-dev-secret"
    s3_region: str = "us-east-1"
    media_url_ttl_s: int = 600

    # --- LLM / RAG. Provider is swappable (app/llm/factory.py); the key never leaves the server.
    llm_provider: str = "gemini"
    embedding_provider: str = ""  # empty = same as llm_provider
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768  # fixed per vector index; changing it means re-embedding
    # Vector DB for RAG chunks (Qdrant). Separate from Mongo; ":memory:" runs in-process (tests).
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "knowledge_chunks"
    llm_timeout_s: float = 30.0
    rag_top_k: int = 5
    rag_min_score: float = 0.5  # raw cosine similarity below this = not a grounded source
    chat_rate_limit_per_min: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
