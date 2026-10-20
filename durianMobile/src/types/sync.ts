import type { Timestamp } from './common';
import type { SelfCheck } from './content';
import type { CareLog, Farm, Plot, Season } from './farm';
import type { Expense, Sale, SalePayment } from './money';
import type { DiseaseCase, MediaAsset, Scan } from './scan';

/** Household tables the server accepts writes for. */
export interface EntityMap {
  farm: Farm;
  plot: Plot;
  season: Season;
  care_log: CareLog;
  expense: Expense;
  sale: Sale;
  sale_payment: SalePayment;
  disease_case: DiseaseCase;
  scan: Scan;
  self_check: SelfCheck;
}
export type EntityName = keyof EntityMap;

/** Plural names used by the snapshot. */
export const SNAPSHOT_KEYS = {
  farm: 'farms',
  plot: 'plots',
  season: 'seasons',
  care_log: 'care_logs',
  expense: 'expenses',
  sale: 'sales',
  sale_payment: 'sale_payments',
  disease_case: 'disease_cases',
  scan: 'scans',
  self_check: 'self_checks',
} as const satisfies Record<EntityName, string>;

export interface Snapshot {
  /** When the server built it. Rows include tombstones. */
  as_of: Timestamp;
  farms: Farm[];
  plots: Plot[];
  seasons: Season[];
  care_logs: CareLog[];
  expenses: Expense[];
  sales: Sale[];
  sale_payments: SalePayment[];
  disease_cases: DiseaseCase[];
  scans: Scan[];
  self_checks: SelfCheck[];
  media_assets: MediaAsset[];
}

/** One write inside a mutation. `data` carries business fields only; the server owns the bookkeeping. */
export interface MutationOp<E extends EntityName = EntityName> {
  entity: E;
  op: 'upsert' | 'delete';
  id: string;
  /** `null` when creating. Otherwise the revision the client last saw. */
  expected_revision: number | null;
  data?: Partial<
    Omit<EntityMap[E], 'id' | 'revision' | 'created_at' | 'updated_at' | 'deleted_at'>
  >;
}

/** All ops commit together or not at all. Same `mutation_id` + same payload returns the first answer. */
export interface Mutation {
  mutation_id: string;
  ops: MutationOp[];
}

export type MutationRow = {
  [E in EntityName]: { entity: E; row: EntityMap[E] };
}[EntityName];

export type MutationResult =
  | { mutation_id: string; status: 'applied'; rows: MutationRow[]; as_of: Timestamp }
  | {
      mutation_id: string;
      status: 'conflict';
      /** The rows as the server has them now. */
      rows: MutationRow[];
      as_of: Timestamp;
    }
  | {
      mutation_id: string;
      status: 'rejected';
      code: string;
      field?: string;
      as_of: Timestamp;
    };

export interface SyncRequest {
  mutations: Mutation[];
}

export interface SyncResponse {
  results: MutationResult[];
}
