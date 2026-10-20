import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

import { MOCK_LATENCY_MS } from '@/config';
import type {
  ChatRequest,
  ChatResponse,
  MediaAsset,
  Mutation,
  Preferences,
  Session,
} from '@/types';

import { answerFromSamples, buildManifest, buildRelease } from './content';
import { db, MOCK_USER } from './db';
import { applyMutations, snapshot } from './server';

interface Context {
  params: string[];
  body: any;
}

class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryable = false,
  ) {
    super(code);
  }
}

type Handler = (ctx: Context) => unknown;

// Hermes has no structuredClone, and every payload is plain JSON.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  [
    'post',
    /^\/v1\/auth\/session$/,
    ({ body }): Session => ({
      token: 'mock-token',
      user: { ...MOCK_USER, provider: body.provider },
    }),
  ],
  ['post', /^\/v1\/auth\/logout$/, () => null],
  ['get', /^\/v1\/me$/, () => ({ user: db.user, preferences: db.preferences })],
  [
    'put',
    /^\/v1\/me\/ai-consent$/,
    ({ body }): Preferences => {
      db.preferences = {
        ...db.preferences,
        ai_consent_version: body.version,
        ai_consented_at: body.version == null ? null : db.clock(),
      };
      return db.preferences;
    },
  ],
  [
    'put',
    /^\/v1\/me\/locale$/,
    ({ body }): Preferences => (db.preferences = { ...db.preferences, locale: body.locale }),
  ],
  [
    'delete',
    /^\/v1\/me$/,
    () => {
      for (const table of Object.values(db.tables)) (table as Map<string, unknown>).clear();
      db.media.clear();
      db.receipts.clear();
      return null;
    },
  ],

  ['get', /^\/v1\/snapshot$/, () => snapshot()],
  [
    'post',
    /^\/v1\/sync$/,
    ({ body }) => ({ results: applyMutations((body as { mutations: Mutation[] }).mutations) }),
  ],

  [
    'post',
    /^\/v1\/media\/prepare$/,
    ({ body }) => {
      // Same asset id → same asset: an interrupted upload resumes instead of starting over.
      const existing = db.media.get(body.asset_id);
      if (existing)
        return {
          asset: existing,
          upload_url: existing.status === 'ready' ? null : 'mock://upload',
        };
      const stamp = db.clock();
      const asset: MediaAsset = {
        id: body.asset_id,
        revision: 1,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
        owner_id: db.user.id,
        object_key: `${db.user.id}/${body.asset_id}`,
        mime_type: body.mime_type,
        size_bytes: body.size_bytes,
        sha256: body.sha256,
        status: 'pending',
      };
      db.media.set(asset.id, asset);
      return { asset, upload_url: 'mock://upload' };
    },
  ],
  [
    'post',
    /^\/v1\/media\/complete$/,
    ({ body }) => {
      const asset = db.media.get(body.asset_id);
      if (!asset) throw new MockHttpError(404, 'not_found');
      const ready: MediaAsset = {
        ...asset,
        status: 'ready',
        revision: asset.revision + 1,
        updated_at: db.clock(),
      };
      db.media.set(ready.id, ready);
      return ready;
    },
  ],

  ['get', /^\/v1\/content\/manifest$/, () => buildManifest(db.contentRelease)],
  [
    'get',
    /^\/v1\/content\/releases\/(\d+)$/,
    ({ params }) => {
      if (db.sim.failRelease) throw new MockHttpError(503, 'unavailable', true);
      if (Number(params[0]) !== db.contentRelease) throw new MockHttpError(404, 'not_found');
      return buildRelease(db.contentRelease);
    },
  ],

  [
    'post',
    /^\/v1\/chat$/,
    ({ body }): ChatResponse => {
      if (db.preferences.ai_consent_version == null)
        throw new MockHttpError(403, 'ai_consent_required');
      const { question, locale } = body as ChatRequest;
      return {
        ...answerFromSamples(question, locale, db.contentRelease),
        answer_locale: locale,
        context_as_of: db.sim.contextAsOf ?? db.clock(),
      };
    },
  ],
  ['post', /^\/v1\/chat\/reports$/, () => ({ id: `report-${db.receipts.size + 1}` })],
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseBody(data: unknown) {
  if (typeof data === 'string') return data ? JSON.parse(data) : undefined;
  return data;
}

/** Axios adapter that answers from `db` instead of the network. Enabled by `EXPO_PUBLIC_USE_MOCK`. */
export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  if (MOCK_LATENCY_MS > 0) await delay(MOCK_LATENCY_MS);
  const method = (config.method ?? 'get').toLowerCase();
  const path = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const requestId = String(config.headers.get('X-Request-Id') ?? '');

  const fail = (status: number, code: string, retryable = false) => {
    const data = { request_id: requestId, code, message: code, retryable };
    const response = { data, status, statusText: code, headers: {}, config };
    return new AxiosError(code, code, config, null, response);
  };

  if (db.sim.offline) throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  const injected = db.sim.failWith.shift();
  if (injected)
    throw fail(injected.status, injected.code, injected.status === 503 || injected.status === 429);

  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const match = pattern.exec(path);
    if (!match) continue;
    try {
      const data = handler({ params: match.slice(1), body: parseBody(config.data) });
      if (db.sim.dropNextResponse) {
        // The server committed, but the answer never reached the phone.
        db.sim.dropNextResponse = false;
        throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      }
      return {
        data: data === undefined || data === null ? data : clone(data),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    } catch (e) {
      if (e instanceof AxiosError) throw e;
      if (e instanceof MockHttpError) throw fail(e.status, e.code, e.retryable);
      throw e;
    }
  }
  throw fail(404, 'not_found');
};
