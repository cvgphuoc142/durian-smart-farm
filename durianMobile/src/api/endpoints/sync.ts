import type { Mutation, MutationRow, Snapshot, SyncResponse } from '@/types';

import { http } from '../client';
import { unwrap } from '../mutations';

export const syncApi = {
  /** Everything the user has acknowledged on the server, tombstones included. */
  snapshot: () => http.get<Snapshot>('/v1/snapshot'),

  /** Raw batch call, one result per mutation. The Scan outbox (Phase 3) uses this. */
  sync: (mutations: Mutation[]) => http.post<SyncResponse>('/v1/sync', { mutations }),

  /**
   * One online write. Resolves with the written rows; a 409 or a rejected result throws an
   * `ApiRequestError`. Safe to call again with the same `Mutation` after a lost response.
   */
  async send(mutation: Mutation): Promise<MutationRow[]> {
    const { results } = await syncApi.sync([mutation]);
    const result = results.find((r) => r.mutation_id === mutation.mutation_id);
    if (!result) throw new Error('No result for the mutation');
    return unwrap(result);
  },
};
