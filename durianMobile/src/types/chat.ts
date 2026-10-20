import type { Locale, Timestamp } from './common';

export interface Citation {
  article_id: string;
  version_id: string;
  version_no: number;
  translation_revision: number;
  source_locale: Locale;
  title: string;
}

export type ChatAnswerStatus = 'answered' | 'insufficient_sources';

export interface ChatRequest {
  question: string;
  locale: Locale;
  season_id?: string;
  case_id?: string;
  /** A few recent turns. */
  history: { role: 'user' | 'assistant'; text: string }[];
  /** When the app last synced, so the server can warn about unsynced local data. */
  client_last_synced_at: Timestamp | null;
}

export interface ChatResponse {
  answer: string;
  answer_locale: Locale;
  status: ChatAnswerStatus;
  /** Computed by the server from the synced snapshot, not taken from the client. */
  context_as_of: Timestamp | null;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: Timestamp;
  response?: ChatResponse;
}

export interface ChatReportRequest {
  question: string;
  answer: string;
  citations: Citation[];
  reason: string | null;
}
