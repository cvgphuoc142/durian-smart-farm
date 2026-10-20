import { AxiosError } from 'axios';

import type { ApiError, EntityName, MutationRow } from '@/types';

/** What the UI switches on. The exact `code` can be more specific; the kind picks the generic text. */
export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'conflict' // 409
  | 'validation' // 422
  | 'rate_limited' // 429
  | 'unavailable' // 503
  | 'server'
  | 'unknown';

export function kindOf(status: number | undefined, code: string): ErrorKind {
  if (code === 'network' || code === 'timeout') return code;
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 409:
      return 'conflict';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    case 503:
      return 'unavailable';
    default:
      return status && status >= 500 ? 'server' : 'unknown';
  }
}

/** The only error type that leaves the API layer. */
export class ApiRequestError extends Error implements ApiError {
  code: string;
  status?: number;
  request_id?: string;
  retryable: boolean;
  field?: string;
  details?: ApiError['details'];
  /** On a 409: the rows as the server has them now, so the form can show the newer version. */
  server?: MutationRow[];

  constructor(init: Partial<ApiError> & { code: string; message: string; server?: MutationRow[] }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.code = init.code;
    this.status = init.status;
    this.request_id = init.request_id;
    this.retryable = init.retryable ?? false;
    this.field = init.field;
    this.details = init.details;
    this.server = init.server;
  }

  get kind(): ErrorKind {
    return kindOf(this.status, this.code);
  }
  get isNetwork() {
    return this.kind === 'network' || this.kind === 'timeout';
  }
  get isConflict() {
    return this.kind === 'conflict';
  }
  /** The server row for one entity after a 409. */
  serverRow<E extends EntityName>(entity: E, id: string) {
    return this.server?.find((r) => r.entity === entity && r.row.id === id)?.row;
  }
}

/** Maps any thrown value to an `ApiRequestError`: server error bodies, timeouts, offline. */
export function normalizeError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const body = error.response?.data as Partial<ApiError> | undefined;
    if (!error.response) {
      const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      return new ApiRequestError({
        code: timeout ? 'timeout' : 'network',
        message: error.message,
        retryable: true,
      });
    }
    return new ApiRequestError({
      ...body,
      code: body?.code ?? `http_${status}`,
      message: body?.message ?? error.message,
      status,
      retryable: body?.retryable ?? (status === 503 || status === 429),
    });
  }
  return new ApiRequestError({
    code: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  });
}

/** i18n key for an error: the specific code if the app has a text for it, else the generic kind. */
export function errorMessageKey(error: ApiRequestError, has: (key: string) => boolean): string {
  const specific = `errors.${error.code}`;
  return has(specific) ? specific : `errors.${error.kind}`;
}
