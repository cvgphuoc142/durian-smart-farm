from app.rag.chunker import chunk_article


def test_chunks_repeat_title_and_respect_cap() -> None:
    body = "\n\n".join(f"Paragraph {i} " + "x" * 300 for i in range(6))
    chunks = chunk_article("Title", body, max_chars=700)
    assert len(chunks) > 1
    assert all(c.startswith("Title\n\n") for c in chunks)
    assert all(len(c) <= 700 + len("Title\n\n") for c in chunks)


def test_oversized_paragraph_is_split() -> None:
    chunks = chunk_article("T", "word " * 1000, max_chars=500)
    assert len(chunks) >= 10


def test_empty_body_yields_nothing() -> None:
    assert chunk_article("T", " \n\n ") == []
