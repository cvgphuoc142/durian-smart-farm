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


@lru_cache
def get_settings() -> Settings:
    return Settings()
