import {
  SNAPSHOT_KEYS,
  type EntityMap,
  type EntityName,
  type Mutation,
  type MutationResult,
  type MutationRow,
  type Snapshot,
} from '@/types';
import { normalizeKg, normalizeVnd } from '@/utils/money';

import { db, type Tables } from './db';
import { validate } from './invariants';

type AnyRow = Record<string, any>;

/** Fields a new row starts with when the client leaves them out. */
const DEFAULTS: { [E in EntityName]: AnyRow } = {
  farm: { province: null, locality_text: null },
  plot: { variety: null, area_ha: null, tree_count: null, planted_year: null },
  season: {
    expected_harvest_on: null,
    closed_on: null,
    forecast_yield_kg: null,
    forecast_price_vnd_kg: null,
    forecast_total_cost_vnd: null,
    forecast_updated_at: null,
  },
  care_log: { case_id: null, photo_id: null, note: null, inputs: [] },
  expense: { care_log_id: null, note: null },
  sale: { total_vnd: null, weight_kg: null, note: null },
  sale_payment: { note: null },
  disease_case: { closed_at: null, location_note: null, note: null },
  scan: {
    case_id: null,
    disease_code: null,
    score: null,
    label_snapshot: null,
    label_locale: null,
    predictions: [],
  },
  self_check: { answers: [] },
};

const VND_FIELDS = new Set([
  'amount_vnd',
  'total_vnd',
  'forecast_price_vnd_kg',
  'forecast_total_cost_vnd',
]);
const KG_FIELDS = new Set(['weight_kg', 'forecast_yield_kg']);

/** Money is rounded half-up to 0,01 and kg to 0,001 on the server too; a bad number is left for validation. */
function canonical(row: AnyRow): AnyRow {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== 'string') continue;
    if (VND_FIELDS.has(k)) out[k] = normalizeVnd(v) ?? v;
    else if (KG_FIELDS.has(k)) out[k] = normalizeKg(v) ?? v;
  }
  return out;
}

/** Stable text of the ops, so key order never makes a retry look like a different payload. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as AnyRow;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const copyTables = (t: Tables): Tables =>
  Object.fromEntries(
    Object.entries(t).map(([k, m]) => [k, new Map(m as Map<string, unknown>)]),
  ) as Tables;

export function snapshot(): Snapshot {
  const out: AnyRow = { as_of: db.clock(), media_assets: [...db.media.values()] };
  for (const entity of Object.keys(SNAPSHOT_KEYS) as EntityName[]) {
    out[SNAPSHOT_KEYS[entity]] = [...db.tables[entity].values()];
  }
  return out as Snapshot;
}

function applyOne(m: Mutation): MutationResult {
  const as_of = db.clock();
  const hash = stable(m.ops);
  const prior = db.receipts.get(m.mutation_id);
  if (prior) {
    if (prior.hash === hash) return prior.result;
    return { mutation_id: m.mutation_id, status: 'rejected', code: 'mutation_id_reused', as_of };
  }

  const work = copyTables(db.tables);
  const written: MutationRow[] = [];
  const touched: { entity: EntityName; id: string }[] = [];

  for (const op of m.ops) {
    const table = work[op.entity] as Map<string, AnyRow>;
    const existing = table.get(op.id);
    let next: AnyRow;

    if (op.op === 'upsert' && !existing) {
      if (op.expected_revision !== null) {
        return { mutation_id: m.mutation_id, status: 'rejected', code: 'not_found', as_of };
      }
      next = canonical({
        ...DEFAULTS[op.entity],
        ...op.data,
        id: op.id,
        revision: 1,
        created_at: as_of,
        updated_at: as_of,
        deleted_at: null,
      });
    } else {
      if (!existing) {
        return { mutation_id: m.mutation_id, status: 'rejected', code: 'not_found', as_of };
      }
      if (existing.deleted_at || existing.revision !== op.expected_revision) {
        return {
          mutation_id: m.mutation_id,
          status: 'conflict',
          rows: [{ entity: op.entity, row: existing } as MutationRow],
          as_of,
        };
      }
      next =
        op.op === 'delete'
          ? { ...existing, deleted_at: as_of, revision: existing.revision + 1, updated_at: as_of }
          : canonical({
              ...existing,
              ...op.data,
              revision: existing.revision + 1,
              updated_at: as_of,
            });
    }

    table.set(op.id, next);
    touched.push({ entity: op.entity, id: op.id });
    written.push({ entity: op.entity, row: next } as MutationRow);
  }

  const violation = validate(work, touched);
  if (violation) {
    return {
      mutation_id: m.mutation_id,
      status: 'rejected',
      code: violation.code,
      field: violation.field,
      as_of,
    };
  }

  db.tables = work as { [E in EntityName]: Map<string, EntityMap[E]> };
  const result: MutationResult = {
    mutation_id: m.mutation_id,
    status: 'applied',
    rows: written,
    as_of,
  };
  db.receipts.set(m.mutation_id, { hash, result });
  return result;
}

/** `POST /v1/sync`: mutations are applied in order, each one all-or-nothing. */
export function applyMutations(mutations: Mutation[]): MutationResult[] {
  return mutations.map(applyOne);
}
