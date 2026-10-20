import { runScan, ScanRuntimeError, type InferenceEngine, type ModelEntry } from '@/ai';
import { newId } from '@/api';
import { scanRepo } from '@/db';
import { removeImage, stageImage } from '@/services';
import type { LocalScan, Locale, NewCase } from '@/types';

import { buildScanMutation, hashPayload } from './buildMutation';

type Draft = Parameters<typeof scanRepo.saveDraft>[0];

/** Runs the model on the staged photo and returns the fields a draft stores. */
async function infer(
  input: {
    entries: readonly ModelEntry[];
    engine: InferenceEngine;
    locale: Locale;
  },
  scan: Pick<LocalScan, 'photo_uri' | 'plant_part'>,
): Promise<
  Pick<
    Draft,
    | 'outcome'
    | 'error_code'
    | 'disease_code'
    | 'score'
    | 'label_snapshot'
    | 'label_locale'
    | 'predictions'
    | 'inference'
  >
> {
  try {
    const r = await runScan({
      entries: input.entries,
      plantPart: scan.plant_part,
      imageUri: scan.photo_uri,
      locale: input.locale,
      engine: input.engine,
    });
    return {
      outcome: r.outcome,
      error_code: null,
      disease_code: r.disease_code,
      score: r.score,
      label_snapshot: r.label_snapshot,
      label_locale: r.label_locale,
      predictions: r.predictions,
      inference: r.inference_metadata,
    };
  } catch (e) {
    // A failed run is a UI state (FR-B11): it keeps the photo so the user can retry, and says so.
    return {
      outcome: 'error',
      error_code: e instanceof ScanRuntimeError ? e.code : 'run',
      disease_code: null,
      score: null,
      label_snapshot: null,
      label_locale: null,
      predictions: [],
      inference: null,
    };
  }
}

export interface RunContext {
  userId: string;
  entries: readonly ModelEntry[];
  engine: InferenceEngine;
  locale: Locale;
}

/**
 * SC-12 "Run": copies the photo to durable storage, runs the model, and keeps the result as a
 * draft. Returns the draft id for the result screen. A failed model run still returns a draft, in
 * the `error` state, that can be retried but never saved.
 */
export async function startScan(
  ctx: RunContext,
  photo: { uri: string; width: number; height: number },
  plantPart: string,
): Promise<string> {
  const id = newId();
  const photoId = newId();
  const staged = await stageImage(photo.uri, photoId, photo);
  const base = {
    id,
    user_id: ctx.userId,
    photo_id: photoId,
    photo_uri: staged.uri,
    mime_type: staged.mime_type,
    size_bytes: staged.size_bytes,
    sha256: staged.sha256,
    plant_part: plantPart,
    captured_at: new Date().toISOString(),
  };
  await scanRepo.saveDraft({ ...base, ...(await infer(ctx, base)) });
  return id;
}

/** Same photo, same body part, another run: "try again" on the error state. */
export async function rerunDraft(ctx: RunContext, draftId: string): Promise<void> {
  const draft = await scanRepo.getScan(ctx.userId, draftId);
  if (!draft || draft.state !== 'draft') return;
  await scanRepo.saveDraft({ ...draft, ...(await infer(ctx, draft)) });
}

/** Drops a draft (or a failed scan the user gave up on) and its photo. */
export async function discardScan(userId: string, id: string): Promise<void> {
  const scan = await scanRepo.getScan(userId, id);
  if (!scan) return;
  await scanRepo.deleteScan(userId, id);
  removeImage(scan.photo_uri);
}

export type CaseChoice =
  | { kind: 'none' }
  | { kind: 'existing'; caseId: string }
  | { kind: 'new'; locationNote: string | null; note: string | null };

/**
 * SC-14 "Save": writes the target and the immutable mutation in one transaction, then the screen
 * may say "saved on device". Sending is the outbox's job and happens when the network allows.
 */
export async function saveScan(
  userId: string,
  draftId: string,
  seasonId: string,
  choice: CaseChoice,
): Promise<LocalScan> {
  const draft = await scanRepo.getScan(userId, draftId);
  if (!draft || draft.state !== 'draft') throw new Error('scan_not_a_draft');
  const newCase: NewCase | null =
    choice.kind === 'new'
      ? {
          id: newId(),
          opened_at: new Date().toISOString(),
          location_note: choice.locationNote,
          note: choice.note,
        }
      : null;
  const target = {
    season_id: seasonId,
    case_id: choice.kind === 'existing' ? choice.caseId : null,
    new_case: newCase,
  };
  const mutation = buildScanMutation(draft, target);
  return scanRepo.queueScan(userId, draftId, target, mutation, hashPayload(mutation.ops));
}

/** "Discard scans and sign out": drops every scan, draft and cached list of this account from the phone. */
export async function discardAllScans(userId: string): Promise<void> {
  const scans = await scanRepo.listScans(userId);
  await scanRepo.clearUser(userId);
  scans.forEach((s) => removeImage(s.photo_uri));
}
