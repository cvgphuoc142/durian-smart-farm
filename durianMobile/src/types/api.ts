import type { Locale, Timestamp } from './common';

/** Error body of every non-2xx response. The UI translates by `code`; `message` is for logs. */
export interface ApiError {
  request_id?: string;
  code: string;
  message: string;
  retryable: boolean;
  /** Dotted path of the offending field, for 422. */
  field?: string;
  details?: { field: string; code: string }[];
  status?: number;
}

export type AuthProvider = 'google' | 'apple';

export interface User {
  id: string;
  provider: AuthProvider;
  display_name: string | null;
}

export interface Preferences {
  locale: Locale;
  ai_consent_version: number | null;
  ai_consented_at: Timestamp | null;
}

export interface Session {
  token: string;
  user: User;
}

export interface Me {
  user: User;
  preferences: Preferences;
}
