import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("durian.access")

SUPPORTED_LOCALES = ("vi", "en")


def pick_locale(header: str | None) -> str:
    if header:
        for part in header.split(","):
            tag = part.split(";")[0].strip().lower()[:2]
            if tag in SUPPORTED_LOCALES:
                return tag
    return "vi"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """X-Request-Id (client's if a valid UUID, else new) + locale + access log.

    The log line carries method, path, status and duration only: no headers, no query
    string, no body, so tokens never reach the logs.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        raw = request.headers.get("x-request-id", "")
        try:
            rid = str(uuid.UUID(raw))
        except ValueError:
            rid = str(uuid.uuid4())
        request.state.request_id = rid
        request.state.locale = pick_locale(request.headers.get("accept-language"))
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        log.info(
            "%s %s -> %d %.1fms rid=%s",
            request.method,
            request.url.path,
            response.status_code,
            (time.perf_counter() - start) * 1000,
            rid,
        )
        return response
