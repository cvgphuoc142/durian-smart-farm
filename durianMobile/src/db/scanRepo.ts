import type { LocalScan, LocalScanState, Mutation, NewCase } from '@/types';

import { getDb } from './client';
import { emitScanChange } from './events';

interface Row {
  id: string;
  user_id: string;
  state: LocalScanState;
  photo_id: string;
  photo_uri: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  plant_part: string;
  captured_at: string;
  outcome: LocalScan['outcome'];
  error_code: string | null;
  disease_code: string | null;
  score: number | null;
  label_snapshot: string | null;
  label_locale: string | null;
  predictions: string;
  inference: string | null;
  season_id: string | null;
  case_id: string | null;
  new_case: string | null;
  mutation_id: string | null;
  media_done: number;
  meta_done: number;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: Row): LocalScan => ({
  ...r,
  predictions: JSON.parse(r.predictions),
  inference: r.inference ? JSON.parse(r.inference) : null,
  new_case: r.new_case ? JSON.parse(r.new_case) : null,
  media_done: r.media_done === 1,
  meta_done: r.meta_done === 1,
});

const now = () => new Date().toISOString();

/** What a draft needs; the rest starts empty. */
export type NewDraft = Omit<
  LocalScan,
  | 'state'
  | 'season_id'
  | 'case_id'
  | 'new_case'
  | 'mutation_id'
  | 'media_done'
  | 'meta_done'
  | 'attempts'
  | 'last_error'
  | 'created_at'
  | 'updated_at'
>;

/** Inserts, or replaces the result of, a draft. A draft is never synced. */
export async function saveDraft(draft: NewDraft): Promise<void> {
  const db = await getDb();
  const stamp = now();
  await db.runAsync(
    `INSERT INTO scan_local (id, user_id, state, photo_id, photo_uri, mime_type, size_bytes, sha256,
       plant_part, captured_at, outcome, error_code, disease_code, score, label_snapshot, label_locale,
       predictions, inference, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       outcome = excluded.outcome, error_code = excluded.error_code,
       disease_code = excluded.disease_code, score = excluded.score,
       label_snapshot = excluded.label_snapshot, label_locale = excluded.label_locale,
       predictions = excluded.predictions, inference = excluded.inference,
       plant_part = excluded.plant_part, updated_at = excluded.updated_at
     WHERE scan_local.state = 'draft'`,
    draft.id,
    draft.user_id,
    draft.photo_id,
    draft.photo_uri,
    draft.mime_type,
    draft.size_bytes,
    draft.sha256,
    draft.plant_part,
    draft.captured_at,
    draft.outcome,
    draft.error_code,
    draft.disease_code,
    draft.score,
    draft.label_snapshot,
    draft.label_locale,
    JSON.stringify(draft.predictions),
    draft.inference ? JSON.stringify(draft.inference) : null,
    stamp,
    stamp,
  );
  emitScanChange();
}

export async function getScan(userId: string, id: string): Promise<LocalScan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    'SELECT * FROM scan_local WHERE id = ? AND user_id = ?',
    id,
    userId,
  );
  return row ? fromRow(row) : null;
}

/** Newest first. Includes drafts. */
export async function listScans(userId: string): Promise<LocalScan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM scan_local WHERE user_id = ? ORDER BY captured_at DESC, created_at DESC',
    userId,
  );
  return rows.map(fromRow);
}

export interface SaveTarget {
  season_id: string;
  case_id: string | null;
  new_case: NewCase | null;
}

/**
 * Turns a draft into a saved scan: the target and the immutable mutation are written in one
 * transaction, so there is never a "saved" scan without something to send (FR-X06).
 */
export async function queueScan(
  userId: string,
  id: string,
  target: SaveTarget,
  mutation: Mutation,
  payloadHash: string,
): Promise<LocalScan> {
  const db = await getDb();
  const stamp = now();
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `UPDATE scan_local SET state = 'saved_on_device', season_id = ?, case_id = ?, new_case = ?,
         mutation_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND state = 'draft' AND outcome != 'error'`,
      target.season_id,
      target.case_id,
      target.new_case ? JSON.stringify(target.new_case) : null,
      mutation.mutation_id,
      stamp,
      id,
      userId,
    );
    if (res.changes !== 1) throw new Error('scan_not_a_draft');
    await db.runAsync(
      `INSERT INTO outbox (mutation_id, user_id, scan_id, payload, payload_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      mutation.mutation_id,
      userId,
      id,
      JSON.stringify(mutation),
      payloadHash,
      stamp,
    );
  });
  emitScanChange();
  return (await getScan(userId, id))!;
}

export interface OutboxItem {
  scan: LocalScan;
  mutation: Mutation;
}

/** Saved scans that still have something to send, oldest first so a case goes before its later scans. */
export async function pendingOutbox(userId: string): Promise<OutboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row & { payload: string | null }>(
    `SELECT s.*, o.payload AS payload FROM scan_local s
       LEFT JOIN outbox o ON o.scan_id = s.id
     WHERE s.user_id = ? AND s.state IN ('saved_on_device', 'sending', 'error') AND s.mutation_id IS NOT NULL
     ORDER BY s.created_at ASC, s.rowid ASC`,
    userId,
  );
  return rows.map((r) => ({
    scan: fromRow(r),
    // After the scan row is acknowledged the payload is gone; only the photo may be left.
    mutation: r.payload ? (JSON.parse(r.payload) as Mutation) : { mutation_id: '', ops: [] },
  }));
}

async function update(userId: string, id: string, set: string, ...params: unknown[]) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE scan_local SET ${set}, updated_at = ? WHERE id = ? AND user_id = ?`,
    ...(params as (string | number | null)[]),
    now(),
    id,
    userId,
  );
  emitScanChange();
}

export const markSending = (userId: string, id: string) =>
  update(userId, id, "state = 'sending', attempts = attempts + 1");

export const markMediaDone = (userId: string, id: string) => update(userId, id, 'media_done = 1');

/** Acknowledged: the outbox row can go. */
export async function markMetaDone(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox WHERE scan_id = ? AND user_id = ?', id, userId);
    await db.runAsync(
      'UPDATE scan_local SET meta_done = 1, updated_at = ? WHERE id = ? AND user_id = ?',
      now(),
      id,
      userId,
    );
  });
  emitScanChange();
}

/** `synced` needs both the data and the photo acknowledged. */
export const markSynced = (userId: string, id: string) =>
  update(userId, id, "state = 'synced', last_error = NULL");

/** Not a failure: the phone is offline or the server is busy. It will be tried again by itself. */
export const markWaiting = (userId: string, id: string, reason: string) =>
  update(userId, id, "state = 'saved_on_device', last_error = ?", reason);

/** A definite refusal or a missing file. Waits for the user. */
export const markError = (userId: string, id: string, code: string) =>
  update(userId, id, "state = 'error', last_error = ?", code);

/** The user asked for another try. */
export const requeue = (userId: string, id: string) =>
  update(userId, id, "state = 'saved_on_device', last_error = NULL");

/** After a crash mid-send, nothing is "sending" any more. */
export async function resetSending(userId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE scan_local SET state = 'saved_on_device' WHERE user_id = ? AND state = 'sending'",
    userId,
  );
  emitScanChange();
}

/** Drafts and failed scans the user chose to drop. A saved scan that is waiting is never deleted here. */
export async function deleteScan(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox WHERE scan_id = ? AND user_id = ?', id, userId);
    await db.runAsync('DELETE FROM scan_local WHERE id = ? AND user_id = ?', id, userId);
  });
  emitScanChange();
}

/** Scans that have not reached the server yet, for the sign-out warning. Failed runs of the model do not count. */
export async function countUnsynced(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM scan_local WHERE user_id = ? AND state != 'synced' AND outcome != 'error'",
    userId,
  );
  return row?.n ?? 0;
}

/** Everything this account has on the phone: used when the account is deleted or its data is dropped. */
export async function clearUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM scan_local WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM read_cache WHERE user_id = ?', userId);
  });
  emitScanChange();
}

/** The hash written when the scan was saved, to check the payload has not changed since. */
export async function outboxHash(userId: string, scanId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload_hash: string }>(
    'SELECT payload_hash FROM outbox WHERE scan_id = ? AND user_id = ?',
    scanId,
    userId,
  );
  return row?.payload_hash ?? null;
}
