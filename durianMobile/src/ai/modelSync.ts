import Constants from 'expo-constants';
import { create } from 'zustand';

import { modelsApi } from '@/api/endpoints/models';

import { appTooOld, parseManifest, SUPPORTED_MANIFEST_SCHEMA } from './manifest';
import { isSameModelFile, useModelStore } from './modelStore';
import { pendingUpdates } from './updates';

/** Ask the server again after this long when the app returns to the foreground (FR-C03 style). */
export const MODEL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ModelCheck = 'up_to_date' | 'update_available' | 'failed' | 'unsupported';

interface StatusState {
  state: 'idle' | 'checking' | 'failed' | 'unsupported';
  error: string | null;
}

/** What the last check did. Not persisted: a fresh start always checks again. */
export const useModelStatus = create<StatusState>(() => ({ state: 'idle', error: null }));

const setStatus = (s: StatusState) => useModelStatus.setState(s);

export const appVersion = () => Constants.expoConfig?.version ?? '0';

export function isModelCheckStale(checkedAt: string | null | undefined, now = Date.now()) {
  if (!checkedAt) return true;
  return now - new Date(checkedAt).getTime() > MODEL_CHECK_INTERVAL_MS;
}

let running: Promise<ModelCheck> | null = null;

async function check(version: string): Promise<ModelCheck> {
  setStatus({ state: 'checking', error: null });
  try {
    const raw = await modelsApi.manifest();
    if (raw.schema_version > SUPPORTED_MANIFEST_SCHEMA) {
      setStatus({ state: 'unsupported', error: 'schema_unsupported' });
      return 'unsupported';
    }
    const { entries, rejected } = parseManifest(raw, (e) =>
      appTooOld(e, version) ? 'app_too_old' : null,
    );
    const store = useModelStore.getState();
    store.setRemote({
      revision: raw.revision ?? null,
      entries,
      needs_app_update: rejected
        .filter((r) => r.reason === 'app_too_old' && r.plant_part)
        .map((r) => r.plant_part as string),
      checked_at: new Date().toISOString(),
    });
    // Same file, new words (notes, beta flag, limits): refresh in place, nothing to download.
    for (const entry of entries) {
      const have = useModelStore.getState().installed[entry.plant_part];
      for (const which of ['current', 'previous'] as const) {
        const slot = have?.[which];
        if (slot && isSameModelFile(slot.entry, entry)) {
          store.patchEntry(entry.plant_part, which, entry);
        }
      }
    }
    setStatus({ state: 'idle', error: null });
    const s = useModelStore.getState();
    return pendingUpdates(s.installed, s.remote).length > 0 ? 'update_available' : 'up_to_date';
  } catch (e) {
    // Whatever failed, the models on the phone keep working.
    const code = (e as { code?: string })?.code ?? (e as Error)?.message ?? 'unknown';
    setStatus({ state: 'failed', error: String(code) });
    return 'failed';
  }
}

/**
 * Asks the server which models are published. Never downloads a model: that waits for the farmer's
 * tap. One run at a time; callers share its result. Never throws.
 */
export function refreshModels(version: string = appVersion()): Promise<ModelCheck> {
  running ??= check(version).finally(() => {
    running = null;
  });
  return running;
}
