import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.errors import ERROR_META, ErrorCode

log = logging.getLogger("durian.api")


class ApiError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str | None = None,
        *,
        field: str | None = None,
        details: list[dict[str, str]] | None = None,
        retry_after: int | None = None,
    ) -> None:
        self.code = code
        self.status, self.retryable = ERROR_META[code]
        self.message = message or code.value
        self.field = field
        self.details = details
        self.retry_after = retry_after


def request_id_of(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def error_response(request: Request, err: ApiError) -> JSONResponse:
    body: dict[str, Any] = {
        "request_id": request_id_of(request),
        "code": err.code.value,
        "message": err.message,
        "retryable": err.retryable,
    }
    if err.field is not None:
        body["field"] = err.field
    if err.details:
        body["details"] = err.details
    headers = {"Retry-After": str(err.retry_after)} if err.retry_after is not None else None
    return JSONResponse(body, status_code=err.status, headers=headers)


_HTTP_TO_CODE = {
    401: ErrorCode.unauthenticated,
    403: ErrorCode.forbidden,
    404: ErrorCode.not_found,
    503: ErrorCode.service_unavailable,
}


def pydantic_error_code(err_type: str) -> ErrorCode:
    """Map a pydantic error type to the catalog. Custom errors named after a catalog code
    (e.g. `must_be_positive`) map to themselves."""
    if err_type in ErrorCode._value2member_map_:
        return ErrorCode(err_type)
    if err_type in {"missing", "string_too_short"}:
        return ErrorCode.required
    if err_type in {"greater_than", "greater_than_equal", "less_than", "less_than_equal"}:
        return ErrorCode.out_of_range
    if err_type.endswith(("_type", "_parsing", "_pattern_mismatch", "_pattern")) or err_type in {
        "enum",
        "literal_error",
        "uuid_parsing",
    }:
        return ErrorCode.invalid_format
    return ErrorCode.validation_failed


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path")),
                "code": pydantic_error_code(e["type"]).value,
            }
            for e in exc.errors()
        ]
        first = details[0] if details else None
        err = ApiError(
            ErrorCode(first["code"]) if first else ErrorCode.validation_failed,
            "Request validation failed",
            field=first["field"] if first else None,
            details=details,
        )
        return error_response(request, err)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_TO_CODE.get(exc.status_code)
        if code is None:
            code = (
                ErrorCode.validation_failed
                if exc.status_code < 500
                else ErrorCode.service_unavailable
            )
        err = ApiError(code)
        # keep the real status for codes not in our map (405 etc.)
        resp = error_response(request, err)
        resp.status_code = exc.status_code if code not in _HTTP_TO_CODE.values() else err.status
        return resp

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Log server-side; never leak a stack or message to the client.
        log.exception("unhandled error request_id=%s", request_id_of(request))
        return error_response(request, ApiError(ErrorCode.service_unavailable))
