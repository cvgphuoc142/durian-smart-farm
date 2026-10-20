import type { ChatReportRequest, ChatRequest, ChatResponse } from '@/types';

import { http } from '../client';

/** Neither call is retried automatically: a retry would cost another LLM call or a second report. */
export const chatApi = {
  ask: (body: ChatRequest) => http.post<ChatResponse>('/v1/chat', body),
  report: (body: ChatReportRequest) => http.post<{ id: string }>('/v1/chat/reports', body),
};
