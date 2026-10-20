import { mutation, upsert } from '@/api';
import type { LocalScan, Mutation, MutationOp, ScanOutcome } from '@/types';

/** Stable text of a payload: the same ops always give the same string, whatever the key order. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a, twice with different seeds. Not a security hash: it only tells a damaged outbox row from a good one. */
export function hashPayload(mutationOps: Mutation['ops']): string {
  const text = stable(mutationOps);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * The one mutation a saved scan sends: its new case first (if it creates one), then the scan.
 * Both commit together, so a scan never points at a case the server does not have.
 * The `mutation_id` is made here, once, and is stored with the payload (FR-X07).
 */
export function buildScanMutation(
  scan: Pick<
    LocalScan,
    | 'id'
    | 'photo_id'
    | 'captured_at'
    | 'plant_part'
    | 'outcome'
    | 'disease_code'
    | 'score'
    | 'label_snapshot'
    | 'label_locale'
    | 'predictions'
    | 'inference'
  >,
  target: { season_id: string; case_id: string | null; new_case: LocalScan['new_case'] },
): Mutation {
  if (scan.outcome === 'error' || !scan.inference) throw new Error('a failed run is never saved');
  const ops: MutationOp[] = [];
  if (target.new_case) {
    ops.push(
      upsert(
        'disease_case',
        target.new_case.id,
        {
          season_id: target.season_id,
          opened_at: target.new_case.opened_at,
          location_note: target.new_case.location_note,
          note: target.new_case.note,
        },
        null,
      ),
    );
  }
  ops.push(
    upsert(
      'scan',
      scan.id,
      {
        season_id: target.season_id,
        case_id: target.new_case?.id ?? target.case_id,
        photo_id: scan.photo_id,
        captured_at: scan.captured_at,
        plant_part: scan.plant_part,
        outcome: scan.outcome as ScanOutcome,
        disease_code: scan.disease_code,
        score: scan.score,
        label_snapshot: scan.label_snapshot,
        label_locale: scan.label_locale,
        predictions: scan.predictions,
        inference_metadata: scan.inference,
      },
      null,
    ),
  );
  return mutation(...ops);
}
