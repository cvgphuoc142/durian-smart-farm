import { ApiRequestError, mediaApi, normalizeError, syncApi } from '@/api';
import { scanRepo } from '@/db';
import { fileExists, uploadPhoto } from '@/services';
import type { LocalScan, Mutation, MutationRow } from '@/types';

import { hashPayload } from './buildMutation';

/** What the runner needs from the outside, so a test can drive it with a fake server and disk. */
export interface OutboxDeps {
  send: (mutation: Mutation) => Promise<MutationRow[]>;
  prepareMedia: typeof mediaApi.prepare;
  completeMedia: typeof mediaApi.complete;
  upload: (url: string, fileUri: string, mimeType: string) => Promise<void>;
  fileExists: (uri: string) => boolean;
  /** Rows the server just acknowledged, to put into the cached snapshot. */
  onAcknowledged?: (rows: MutationRow[]) => void;
}

export const defaultDeps: OutboxDeps = {
  send: (m) => syncApi.send(m),
  prepareMedia: mediaApi.prepare,
  completeMedia: mediaApi.complete,
  upload: uploadPhoto,
  fileExists,
};

export interface RunSummary {
  synced: number;
  failed: number;
  /** Stopped early because the network, the session or the server said to wait. */
  stopped: 'offline' | 'unauthorized' | 'busy' | null;
}

/** Photo first: `prepare` with the fixed asset id, upload if the server does not have it, `complete`. */
async function sendPhoto(scan: LocalScan, deps: OutboxDeps) {
  if (!deps.fileExists(scan.photo_uri)) throw new LocalFileMissing();
  const { asset, upload_url } = await deps.prepareMedia({
    asset_id: scan.photo_id,
    mime_type: scan.mime_type,
    size_bytes: scan.size_bytes,
    sha256: scan.sha256,
  });
  if (asset.status !== 'ready') {
    if (!upload_url) throw new ApiRequestError({ code: 'upload_failed', message: 'no upload url' });
    await deps.upload(upload_url, scan.photo_uri, scan.mime_type);
    await deps.completeMedia(scan.photo_id);
  }
}

class LocalFileMissing extends Error {}

/** A case made by an earlier scan that the server has not acknowledged yet. */
function waitingOnCase(scan: LocalScan, all: LocalScan[]) {
  if (!scan.case_id) return null;
  const owner = all.find((s) => s.new_case?.id === scan.case_id && s.id !== scan.id);
  return owner && !owner.meta_done ? owner : null;
}

let running: Promise<RunSummary> | null = null;

/**
 * Sends every saved scan of this account that is not on the server yet (FR-X06, FR-B10).
 *
 * - Oldest first; a scan that attaches to a case still waiting in the outbox waits for it.
 * - Each step is recorded before the next one starts, so a crash resumes where it stopped and a
 *   photo or mutation that was acknowledged is never sent again.
 * - The same `mutation_id` is used on every attempt, so a lost answer cannot make a duplicate.
 * - A network or server-busy failure keeps the scan queued and stops the run; a definite refusal
 *   marks that scan `error` and moves on.
 * - One run at a time.
 */
export function runOutbox(userId: string, deps: OutboxDeps = defaultDeps): Promise<RunSummary> {
  running ??= run(userId, deps).finally(() => {
    running = null;
  });
  return running;
}

async function run(userId: string, deps: OutboxDeps): Promise<RunSummary> {
  const summary: RunSummary = { synced: 0, failed: 0, stopped: null };
  const items = await scanRepo.pendingOutbox(userId);
  const scans = items.map((i) => i.scan);

  // Also updates the in-memory copy, which a later scan in this run may be waiting on.
  let current: LocalScan | null = null;
  const fail = async (code: string) => {
    await scanRepo.markError(userId, current!.id, code);
    current!.state = 'error';
    summary.failed++;
  };

  for (const { scan, mutation } of items) {
    current = scan;
    if (scan.state === 'error') continue;
    const blocker = waitingOnCase(scan, scans);
    if (blocker) {
      if (blocker.state === 'error') await fail('case_not_synced');
      continue;
    }

    await scanRepo.markSending(userId, scan.id);
    try {
      if (!scan.media_done) {
        await sendPhoto(scan, deps);
        await scanRepo.markMediaDone(userId, scan.id);
      }
      if (!scan.meta_done) {
        if (hashPayload(mutation.ops) !== (await expectedHash(userId, scan.id, mutation))) {
          throw new OutboxDamaged();
        }
        const rows = await deps.send(mutation);
        await scanRepo.markMetaDone(userId, scan.id);
        scan.meta_done = true;
        deps.onAcknowledged?.(rows);
      }
      await scanRepo.markSynced(userId, scan.id);
      summary.synced++;
    } catch (e) {
      if (e instanceof LocalFileMissing) {
        await fail('photo_missing');
        continue;
      }
      if (e instanceof OutboxDamaged) {
        await fail('outbox_damaged');
        continue;
      }
      const err = normalizeError(e);
      if (err.kind === 'unauthorized') {
        await scanRepo.markWaiting(userId, scan.id, err.code);
        summary.stopped = 'unauthorized';
        break;
      }
      if (err.isNetwork) {
        await scanRepo.markWaiting(userId, scan.id, err.code);
        summary.stopped = 'offline';
        break;
      }
      if (err.retryable || err.kind === 'rate_limited' || err.kind === 'unavailable') {
        await scanRepo.markWaiting(userId, scan.id, err.code);
        summary.stopped = 'busy';
        break;
      }
      // A refusal (422, 409, 403): sending it again changes nothing, so it waits for the user.
      await fail(err.code);
    }
  }
  return summary;
}

class OutboxDamaged extends Error {}

async function expectedHash(userId: string, scanId: string, m: Mutation) {
  const hash = await scanRepo.outboxHash(userId, scanId);
  return hash ?? hashPayload(m.ops);
}
