"""Split an article into retrieval chunks on paragraph boundaries. Every chunk repeats the
title so it still means something when retrieved alone."""

MAX_CHARS = 900


def chunk_article(title: str, body: str, max_chars: int = MAX_CHARS) -> list[str]:
    paragraphs = [p.strip() for p in body.replace("\r\n", "\n").split("\n\n") if p.strip()]
    pieces: list[str] = []
    for p in paragraphs:
        while len(p) > max_chars:  # one oversized paragraph: cut at the last space before the cap
            cut = p.rfind(" ", 0, max_chars)
            cut = cut if cut > 0 else max_chars
            pieces.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            pieces.append(p)
    chunks: list[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(piece) + 2 > max_chars:
            chunks.append(current)
            current = piece
        else:
            current = f"{current}\n\n{piece}" if current else piece
    if current:
        chunks.append(current)
    return [f"{title}\n\n{c}" for c in chunks]
