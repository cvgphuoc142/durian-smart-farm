import { useMemo } from 'react';

import { useAppContext } from '@/stores/contextStore';
import type { Season, SelfCheck } from '@/types';

import { useScanTargets } from './scan';

/**
 * The season picked in the app and its ticks, from the live snapshot or, offline, from the copy
 * kept on the phone. Never suspends, so Standards and the chat open without a network.
 */
export function useSeasonLite(): {
  season: Season | null;
  selfChecks: SelfCheck[];
  /** When the server built the data shown. */
  asOf: string | null;
  fromCache: boolean;
  loading: boolean;
} {
  const { refs, fromCache, loading } = useScanTargets();
  const ctx = useAppContext();
  return useMemo(() => {
    const seasons = refs?.seasons ?? [];
    const season =
      seasons.find((s) => s.id === ctx.seasonId) ??
      seasons.find((s) => s.closed_on == null) ??
      seasons[0] ??
      null;
    return {
      season,
      selfChecks: (refs?.self_checks ?? []).filter((c) => c.season_id === season?.id),
      asOf: refs?.as_of ?? null,
      fromCache,
      loading,
    };
  }, [refs, ctx.seasonId, fromCache, loading]);
}
