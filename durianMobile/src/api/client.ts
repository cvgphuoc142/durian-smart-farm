import axios from 'axios';

import { API_URL, USE_MOCK } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

import { normalizeError } from './errors';
import { newId } from './ids';
import { mockAdapter } from './mock/adapter';

// eslint-disable-next-line import/no-named-as-default-member -- `axios.create` is the documented API
export const client = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
  ...(USE_MOCK ? { adapter: mockAdapter } : null),
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  const locale = useSettingsStore.getState().locale;
  if (locale) config.headers.set('Accept-Language', locale);
  // One id per HTTP attempt, echoed in error bodies so a report can be matched to a server log.
  config.headers.set('X-Request-Id', newId());
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalized = normalizeError(error);
    // An expired or revoked session ends here; the navigator gate then shows sign-in.
    if (normalized.status === 401 && useAuthStore.getState().token) {
      void useAuthStore.getState().signOut();
    }
    return Promise.reject(normalized);
  },
);

/** Helpers that unwrap `response.data`. */
export const http = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    client.get<T>(url, { params }).then((r) => r.data),
  post: <T>(url: string, body?: unknown) => client.post<T>(url, body).then((r) => r.data),
  put: <T>(url: string, body?: unknown) => client.put<T>(url, body).then((r) => r.data),
  delete: <T>(url: string) => client.delete<T>(url).then((r) => r.data),
};
