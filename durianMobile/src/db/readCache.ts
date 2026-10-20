import type { DiseaseCase, Farm, Plot, SelfCheck, Season, Snapshot, Timestamp } from '@/types';

import { getDb } from './client';

/** What the app needs to save a scan without the network: where it goes, and which cases are open. */
export interface ScanRefs {
  farms: Farm[];
  plots: Plot[];
  seasons: Season[];
  /** Open cases only. */
  cases: DiseaseCase[];
  /** The ticks of each season's checklist, so Standards opens offline with them (FR-D02). */
  self_checks: SelfCheck[];
  /** When the server built the snapshot these rows come from. */
  as_of: Timestamp | null;
}

const KEY = 'scan_refs';

const alive = <T extends { deleted_at: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => !r.deleted_at);

export function refsFromSnapshot(s: Snapshot): ScanRefs {
  return {
    farms: alive(s.farms),
    plots: alive(s.plots),
    seasons: alive(s.seasons),
    cases: alive(s.disease_cases).filter((c) => c.closed_at == null),
    self_checks: alive(s.self_checks),
    as_of: s.as_of,
  };
}

export async function writeRefs(userId: string, refs: ScanRefs): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO read_cache (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    userId,
    KEY,
    JSON.stringify(refs),
    new Date().toISOString(),
  );
}

export async function readRefs(userId: string): Promise<ScanRefs | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM read_cache WHERE user_id = ? AND key = ?',
    userId,
    KEY,
  );
  // Rows written before ticks were kept lack those fields.
  return row ? ({ self_checks: [], as_of: null, ...JSON.parse(row.value) } as ScanRefs) : null;
}
