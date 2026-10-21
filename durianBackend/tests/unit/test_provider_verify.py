import asyncio
import time
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.api.errors import ApiError
from app.auth.providers import ProviderVerifier
from app.config import Settings

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _Jwks:
    def get_signing_key_from_jwt(self, token: str) -> Any:
        class K:
            key = KEY.public_key()

        return K()


def verifier(env: str = "prod") -> ProviderVerifier:
    s = Settings(app_env=env, google_client_ids=["g-client"], apple_client_ids=["com.durian"])
    return ProviderVerifier(s, {"google": _Jwks(), "apple": _Jwks()})


def token(**over: Any) -> str:
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "g-client",
        "sub": "123",
        "name": "Lan",
        "email": "lan@example.com",
        "exp": int(time.time()) + 600,
    } | over
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, KEY, algorithm="RS256")


def run(v: ProviderVerifier, provider: str, tok: str) -> Any:
    return asyncio.run(v.verify(provider, tok))


def test_valid_google_token() -> None:
    ident = run(verifier(), "google", token())
    assert (ident.provider, ident.subject, ident.display_name) == ("google", "123", "Lan")


@pytest.mark.parametrize(
    "over",
    [{"aud": "other"}, {"iss": "https://evil.example"}, {"exp": 1}, {"sub": None}],
)
def test_bad_claims_rejected(over: dict[str, Any]) -> None:
    with pytest.raises(ApiError) as e:
        run(verifier(), "google", token(**over))
    assert e.value.code.value == "invalid_provider_token"


def test_wrong_signature_rejected() -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    bad = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": "g-client",
            "sub": "1",
            "exp": int(time.time()) + 60,
        },
        other,
        algorithm="RS256",
    )
    with pytest.raises(ApiError):
        run(verifier(), "google", bad)


def test_apple_uses_its_own_issuer() -> None:
    ok = token(iss="https://appleid.apple.com", aud="com.durian")
    assert run(verifier(), "apple", ok).provider == "apple"
    with pytest.raises(ApiError):
        run(verifier(), "apple", token())  # google issuer on the apple path


def test_dev_token_only_in_dev() -> None:
    assert run(verifier("dev"), "google", "dev:demo:Demo").subject == "demo"
    with pytest.raises(ApiError):
        run(verifier("prod"), "google", "dev:demo")
