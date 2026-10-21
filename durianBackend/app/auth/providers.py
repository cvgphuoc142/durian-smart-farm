"""Verify a Google / Apple `id_token` (signature via the provider's JWKS, iss, aud, exp).

The subject (`sub`) is the identity; email is never read, so accounts are never merged by it.
In `APP_ENV=dev` a `dev:<subject>[:<display name>]` token is accepted as a Google login so
Swagger and the seed can sign in without a real provider.
"""

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol

import jwt
from jwt import PyJWKClient

from app.api.errors import ApiError
from app.config import Settings
from app.domain.errors import ErrorCode

_PROVIDERS: dict[str, dict[str, Any]] = {
    "google": {
        "jwks": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": ("https://accounts.google.com", "accounts.google.com"),
    },
    "apple": {
        "jwks": "https://appleid.apple.com/auth/keys",
        "issuers": ("https://appleid.apple.com",),
    },
}


@dataclass(frozen=True)
class Identity:
    provider: str
    subject: str
    display_name: str | None


class Verifier(Protocol):
    async def verify(self, provider: str, id_token: str) -> Identity: ...


class ProviderVerifier:
    def __init__(self, settings: Settings, jwks_clients: dict[str, Any] | None = None) -> None:
        self._settings = settings
        self._jwks = jwks_clients or {
            name: PyJWKClient(cfg["jwks"], cache_keys=True, lifespan=3600)
            for name, cfg in _PROVIDERS.items()
        }

    async def verify(self, provider: str, id_token: str) -> Identity:
        if self._settings.app_env == "dev" and id_token.startswith("dev:"):
            _, _, rest = id_token.partition(":")
            subject, _, name = rest.partition(":")
            if not subject:
                raise ApiError(ErrorCode.invalid_provider_token)
            return Identity(provider, subject, name or None)
        return await asyncio.to_thread(self._verify_sync, provider, id_token)

    def _verify_sync(self, provider: str, id_token: str) -> Identity:
        audiences = (
            self._settings.google_client_ids
            if provider == "google"
            else self._settings.apple_client_ids
        )
        if provider not in _PROVIDERS or not audiences:
            raise ApiError(ErrorCode.invalid_provider_token)
        try:
            key = self._jwks[provider].get_signing_key_from_jwt(id_token).key
            claims = jwt.decode(
                id_token,
                key,
                algorithms=["RS256"],
                audience=audiences,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            raise ApiError(ErrorCode.service_unavailable) from exc
        except jwt.PyJWTError as exc:
            raise ApiError(ErrorCode.invalid_provider_token) from exc
        if claims["iss"] not in _PROVIDERS[provider]["issuers"] or not claims["sub"]:
            raise ApiError(ErrorCode.invalid_provider_token)
        name = claims.get("name")
        return Identity(provider, str(claims["sub"]), name if isinstance(name, str) else None)
