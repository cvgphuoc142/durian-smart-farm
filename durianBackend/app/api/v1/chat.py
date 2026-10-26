from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.api.deps import CurrentUser, current_user, get_database
from app.llm.base import ChatTurn
from app.rag import chat as rag_chat
from app.sync.receipts import utcnow_ms

router = APIRouter(prefix="/v1/chat", tags=["AI"])

Db = Annotated[AsyncDatabase[Any], Depends(get_database)]
User = Annotated[CurrentUser, Depends(current_user)]


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)
    locale: Literal["vi", "en"]
    season_id: UUID | None = None
    case_id: UUID | None = None
    history: list[HistoryTurn] = Field(max_length=6)
    client_last_synced_at: str | None


class Citation(BaseModel):
    article_id: UUID
    version_id: UUID
    version_no: int = Field(ge=1)
    title: str


class ChatReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    citations: list[Citation]
    reason: str | None


@router.post("", operation_id="chat")
async def chat(body: ChatRequest, request: Request, user: User, db: Db) -> dict[str, Any]:
    state = request.app.state
    await rag_chat.check_consent(db, user.id)  # before anything else: nothing leaves without it
    await rag_chat.check_rate_limit(db, user.id, state.settings.chat_rate_limit_per_min)
    context, as_of = await rag_chat.farm_context(db, user.id, body.season_id, body.case_id)
    reply = await rag_chat.answer(
        question=body.question,
        locale=body.locale,
        history=[ChatTurn(t.role, t.text) for t in body.history],
        context=context,
        context_as_of=as_of,
        retriever=state.retriever,
        llm=state.llm,
        top_k=state.settings.rag_top_k,
        min_score=state.settings.rag_min_score,
    )
    return {
        "answer": reply.answer,
        "answer_locale": reply.answer_locale,
        "status": reply.status,
        "context_as_of": reply.context_as_of,
        "citations": reply.citations,
    }


@router.post("/reports", operation_id="reportChatAnswer", status_code=201)
async def report_answer(
    body: ChatReportRequest,
    user: User,
    db: Db,
    idempotency_key: Annotated[UUID | None, Header()] = None,
) -> dict[str, Any]:
    key = str(idempotency_key or uuid4())
    now = utcnow_ms()
    doc = {
        "_id": uuid4(),
        "user_id": user.id,
        "idempotency_key": key,
        "question": body.question,
        "answer": body.answer,
        "citations": [c.model_dump(mode="json") for c in body.citations],
        "reason": body.reason,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db["chat_reports"].insert_one(doc)
    except DuplicateKeyError:
        doc = await db["chat_reports"].find_one({"user_id": user.id, "idempotency_key": key})  # type: ignore[assignment]
    return {"id": str(doc["_id"])}
