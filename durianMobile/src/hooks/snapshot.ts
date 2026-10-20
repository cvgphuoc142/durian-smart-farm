import { useQueryClient, useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { syncApi } from '@/api';
import { useAppContext } from '@/stores/contextStore';
import {
  SNAPSHOT_KEYS,
  type EntityMap,
  type EntityName,
  type MutationRow,
  type Snapshot,
} from '@/types';

import { qk, useUserId } from './queryKeys';

/** Tombstones come back in the snapshot so deletes sync; screens never show them. */
export const live = <T extends { deleted_at: string | null }>(rows: readonly T[]): T[] =>
  rows.filter((r) => !r.deleted_at);

/** The household data the server has acknowledged. Suspends until loaded; wrap the screen in `QueryBoundary`. */
export function useSnapshot() {
  const userId = useUserId();
  return useSuspenseQuery({
    queryKey: qk.snapshot(userId),
    queryFn: syncApi.snapshot,
  });
}

/** Live rows of one table. */
export function useRows<E extends EntityName>(entity: E): EntityMap[E][] {
  const { data } = useSnapshot();
  return live(data[SNAPSHOT_KEYS[entity]] as unknown as EntityMap[E][]);
}

/** Puts rows the server just wrote into the cached snapshot, so the UI updates without a refetch. */
export function patchSnapshot(
  client: QueryClient,
  userId: string | null,
  rows: readonly MutationRow[],
) {
  client.setQueryData<Snapshot>(qk.snapshot(userId), (old) => {
    if (!old) return old;
    const next: Record<string, unknown> = { ...old };
    for (const { entity, row } of rows) {
      const key = SNAPSHOT_KEYS[entity];
      const list = (next[key] as { id: string; revision: number }[]).filter((r) => r.id !== row.id);
      next[key] = [...list, row];
    }
    return next as unknown as Snapshot;
  });
}

export function usePatchSnapshot() {
  const client = useQueryClient();
  const userId = useUserId();
  return useCallback(
    (rows: readonly MutationRow[]) => patchSnapshot(client, userId, rows),
    [client, userId],
  );
}

/** The farm, plot and season the user picked, resolved against live rows. Falls back to the first open season. */
export function useSelection() {
  const { data } = useSnapshot();
  const ctx = useAppContext();
  return resolveSelection(data, ctx);
}

export function resolveSelection(
  data: Snapshot,
  ctx: { farmId: string | null; plotId: string | null; seasonId: string | null },
) {
  const farms = live(data.farms);
  const plots = live(data.plots);
  const seasons = live(data.seasons);
  const season =
    seasons.find((s) => s.id === ctx.seasonId) ??
    seasons.find((s) => s.closed_on == null) ??
    seasons[0] ??
    null;
  const plot =
    plots.find((p) => p.id === season?.plot_id) ?? plots.find((p) => p.id === ctx.plotId) ?? null;
  const farm =
    farms.find((f) => f.id === plot?.farm_id) ?? farms.find((f) => f.id === ctx.farmId) ?? null;
  return { farm, plot, season };
}

/** After sign-in on a new phone: restores the last sensible context from the downloaded snapshot. */
export function contextFromSnapshot(data: Snapshot) {
  const { farm, plot, season } = resolveSelection(data, {
    farmId: null,
    plotId: null,
    seasonId: null,
  });
  return { farmId: farm?.id ?? null, plotId: plot?.id ?? null, seasonId: season?.id ?? null };
}
