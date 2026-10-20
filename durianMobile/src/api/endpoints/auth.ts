import type { AuthProvider, Me, Preferences, Session } from '@/types';

import { http } from '../client';

/** Answer of `DELETE /v1/me`. `media_pending` photos are removed by the server afterwards. */
export interface DeleteAccountResult {
  status: 'deleted';
  session_revoked: boolean;
  media_pending: number;
}

/** Wire contract: `durianBackend/openapi.json` (`authExchange`, `logout`, `getMe`, `setLocale`, `setAiConsent`, `deleteAccount`). */
export const authApi = {
  exchange: (provider: AuthProvider, idToken: string) =>
    http.post<Session>('/v1/auth/session', { provider, id_token: idToken }),
  /** Revokes the calling session (204). */
  logout: () => http.post<void>('/v1/auth/logout'),
  me: () => http.get<Me>('/v1/me'),
  /** Grant or withdraw consent for the external AI service. `null` withdraws. */
  setAiConsent: (version: number | null) => http.put<Preferences>('/v1/me/ai-consent', { version }),
  setLocale: (locale: Preferences['locale']) => http.put<Preferences>('/v1/me/locale', { locale }),
  deleteAccount: () => http.delete<DeleteAccountResult>('/v1/me'),
};
