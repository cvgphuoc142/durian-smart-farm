import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiRequestError, errorMessageKey, mutation, syncApi } from '@/api';
import { useToast } from '@/components/ui';
import type { Mutation, MutationOp, MutationRow } from '@/types';

import { usePatchSnapshot } from './snapshot';
import { useIsOnline } from './useIsOnline';

/** A readable message for any error, in the UI language. */
export function useApiErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const e =
      error instanceof ApiRequestError
        ? error
        : new ApiRequestError({ code: 'unknown', message: String(error) });
    return t(errorMessageKey(e, (key) => i18n.exists(key)));
  };
}

/**
 * Online write for every non-scan form (FR-X05, FR-X07).
 *
 * - Offline: refuses, shows the banner text, and the form keeps its draft. Nothing is queued.
 * - One tap = one `mutation_id`. If the send fails and the user taps again with the same ops,
 *   the same id goes out again, so the server can answer from its receipt instead of writing twice.
 * - Never retried automatically.
 * - A 409 is not toasted: the screen reads `error.serverRow(...)` and shows the newer version.
 */
export function useWrite(options?: {
  onSuccess?: (rows: MutationRow[]) => void;
  /** A 409: the cached snapshot already holds the newer rows; the form reloads from them. */
  onConflict?: (rows: MutationRow[]) => void;
}) {
  const online = useIsOnline();
  const toast = useToast();
  const patch = usePatchSnapshot();
  const errorMessage = useApiErrorMessage();
  const { t } = useTranslation();
  const pending = useRef<{ key: string; mutation: Mutation } | null>(null);

  const mutate = useMutation({
    mutationFn: async (ops: MutationOp[]) => {
      if (!online)
        throw new ApiRequestError({ code: 'network', message: 'offline', retryable: true });
      const key = JSON.stringify(ops);
      if (pending.current?.key !== key) pending.current = { key, mutation: mutation(...ops) };
      return syncApi.send(pending.current.mutation);
    },
    onSuccess: (rows) => {
      pending.current = null;
      patch(rows);
      options?.onSuccess?.(rows);
    },
    onError: (error) => {
      // Keep the id only when the answer may have been lost; a definite refusal starts fresh.
      if (!(error instanceof ApiRequestError) || !error.retryable) pending.current = null;
      if (error instanceof ApiRequestError && error.isConflict) {
        if (error.server) {
          patch(error.server);
          options?.onConflict?.(error.server);
        }
        return;
      }
      toast.show(
        error instanceof ApiRequestError && error.isNetwork
          ? t('errors.saveOffline')
          : errorMessage(error),
        'error',
      );
    },
  });

  return { ...mutate, online };
}
