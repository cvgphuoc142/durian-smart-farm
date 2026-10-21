from app.auth.store import hash_password, verify_password


def test_password_roundtrip() -> None:
    stored = hash_password("123456")
    assert verify_password("123456", stored)
    assert not verify_password("654321", stored)


def test_hashes_are_salted_and_garbage_is_rejected() -> None:
    assert hash_password("123456") != hash_password("123456")
    assert not verify_password("123456", "not-a-hash")
