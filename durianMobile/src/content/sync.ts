import { create } from 'zustand';

import { contentApi } from '@/api';
import { contentRepo } from '@/db';
import type { ContentManifest, ContentRelease } from '@/types';

import { emitContentChange } from './events';

/** Newest content schema this build can read. A newer release needs a newer app. */
export const SUPPORTED_SCHEMA = 1;

/** Ask the server again after this long when the app returns to the foreground (FR-C03). */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ContentCheck = 'up_to_date' | 'updated' | 'failed' | 'unsupported';

interface StatusState {
  state: 'idle' | 'checking' | 'failed' | 'unsupported';
  /** Code of the last failure, for the Knowledge screen. */
  error: string | null;
}

/** What the last check did. Not persisted: a fresh start always checks again. */
export const useContentStatus = create<StatusState>(() => ({ state: 'idle', error: null }));

const setStatus = (s: StatusState) => useContentStatus.setState(s);

/**
 * A downloaded release is only installed if it is the one the manifest announced and is complete.
 * The contract does not say how `checksum` is computed from the body, so it is compared with the
 * manifest's, not recomputed.
 */
export function validateRelease(manifest: ContentManifest, release: ContentRelease) {
  const ok =
    release.release_no === manifest.release_no &&
    release.checksum === manifest.checksum &&
    Array.isArray(release.articles) &&
    Array.isArray(release.diseases) &&
    Array.isArray(release.standard_profiles) &&
    Array.isArray(release.standard_versions) &&
    Array.isArray(release.contacts) &&
    release.articles.every((a) => a.id && a.version_id && a.locale && a.title != null) &&
    release.standard_versions.every((v) => v.id && v.locale && Array.isArray(v.items));
  if (!ok) throw new Error('invalid_release');
}

export function isStale(meta: { checked_at: string } | null, now = Date.now()): boolean {
  if (!meta?.checked_at) return true;
  return now - new Date(meta.checked_at).getTime() > CHECK_INTERVAL_MS;
}

let running: Promise<ContentCheck> | null = null;

async function check(): Promise<ContentCheck> {
  setStatus({ state: 'checking', error: null });
  try {
    const manifest = await contentApi.manifest();
    if (manifest.schema_version > SUPPORTED_SCHEMA) {
      setStatus({ state: 'unsupported', error: 'schema_unsupported' });
      return 'unsupported';
    }
    const meta = await contentRepo.getMeta();
    const now = new Date().toISOString();
    if (meta && meta.release_no === manifest.release_no && meta.checksum === manifest.checksum) {
      await contentRepo.touchChecked(now);
      setStatus({ state: 'idle', error: null });
      return 'up_to_date';
    }
    // The whole release is held in memory, checked, then swapped in by one transaction.
    const release = await contentApi.release(manifest.release_no);
    validateRelease(manifest, release);
    await contentRepo.installRelease(release, now);
    emitContentChange();
    setStatus({ state: 'idle', error: null });
    return 'updated';
  } catch (e) {
    // Whatever failed, the pack that was there stays and keeps working.
    const code = (e as { code?: string })?.code ?? (e as Error)?.message ?? 'unknown';
    setStatus({ state: 'failed', error: String(code) });
    return 'failed';
  }
}

/**
 * Looks for a newer release and installs it. One run at a time; callers share its result.
 * Never throws and never retries by itself (the triggers are open, reconnect, foreground and the
 * refresh button; there is no background download).
 */
export function refreshContent(): Promise<ContentCheck> {
  running ??= check().finally(() => {
    running = null;
  });
  return running;
}
