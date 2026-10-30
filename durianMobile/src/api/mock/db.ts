import type { EntityMap, EntityName, MediaAsset, MutationResult, Preferences, User } from '@/types';

export type Tables = { [E in EntityName]: Map<string, EntityMap[E]> };

export interface Receipt {
  /** Canonical form of the ops, to tell a retry from a reused id. */
  hash: string;
  result: MutationResult;
}

const emptyTables = (): Tables => ({
  farm: new Map(),
  plot: new Map(),
  season: new Map(),
  care_log: new Map(),
  expense: new Map(),
  sale: new Map(),
  sale_payment: new Map(),
  disease_case: new Map(),
  scan: new Map(),
  self_check: new Map(),
});

export const MOCK_USER: User = { id: 'mock-user', provider: 'google', display_name: 'Chủ vườn' };

function create() {
  return {
    user: MOCK_USER,
    preferences: { locale: 'vi', ai_consent_version: null, ai_consented_at: null } as Preferences,
    tables: emptyTables(),
    media: new Map<string, MediaAsset>(),
    /** `(mutation_id)` → first answer. Same id + same payload gets this back instead of a second write. */
    receipts: new Map<string, Receipt>(),
    /** The content release the "server" has published; raise it to simulate a new publish. */
    contentRelease: 1,
    /** The scan models the "server" has published (manifest entries). Empty by default. */
    models: [] as unknown[],
    /** Test hooks. */
    sim: {
      /** The release download fails while the manifest still answers (a broken download). */
      failRelease: false,
      /** Overrides `context_as_of` in chat answers, to test a stale snapshot. */
      contextAsOf: null as string | null,
      /** Commit the next request, then fail the response as if the network dropped (lost ack). */
      dropNextResponse: false,
      /** Every request fails as offline. */
      offline: false,
      /** Make the next requests fail with this status once each, e.g. 503. */
      failWith: [] as { status: number; code: string; field?: string }[],
    },
    clock: () => new Date().toISOString(),
  };
}

/** In-memory "server". Writes live until the app restarts, like a real backend would not. */
export let db = create();

export function resetMockDb() {
  db = create();
}
