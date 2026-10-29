import { useMemo } from 'react';

import {
  pendingUpdates,
  refreshModels,
  useModelStatus,
  useModelStore,
  useModelTransfer,
  withStubs,
  type ModelEntry,
  type ParsedManifest,
} from '@/ai';
import { modelFiles } from '@/ai/modelFiles';
import type { InferenceMetadata } from '@/types';

const NO_REJECTED: ParsedManifest['rejected'] = [];

/**
 * The models the app can run now: for each body part the one installed on the phone, if its file is
 * still there (FR-B02). Nothing is listed that the server has not published and the farmer has not
 * downloaded, and nothing is hard-coded: a new part appears here once its model is installed.
 */
export function useScanModels(): ParsedManifest {
  const installed = useModelStore((s) => s.installed);
  return useMemo(() => {
    const entries: ModelEntry[] = [];
    for (const part of Object.keys(installed).sort()) {
      const { current } = installed[part];
      if (modelFiles.exists(current.file)) entries.push(current.entry);
    }
    return withStubs({ entries, rejected: NO_REJECTED });
  }, [installed]);
}

/** The model entry that produced a stored scan, if it is still on the phone; else the part's current one. */
export function useScanEntry(
  plantPart: string | undefined,
  inference: InferenceMetadata | null | undefined,
) {
  const installed = useModelStore((s) => s.installed);
  return useMemo(() => {
    const have = plantPart ? installed[plantPart] : undefined;
    if (!have) return null;
    for (const m of [have.current, have.previous]) {
      if (
        m &&
        inference &&
        m.entry.model_id === inference.model_id &&
        m.entry.version === inference.model_version
      ) {
        return m.entry;
      }
    }
    return have.current.entry;
  }, [installed, plantPart, inference]);
}

/** What the server offers that the phone does not have yet: drives the red dot and the banners. */
export function useModelUpdates() {
  const installed = useModelStore((s) => s.installed);
  const remote = useModelStore((s) => s.remote);
  return useMemo(() => {
    const updates = pendingUpdates(installed, remote);
    return {
      updates,
      count: updates.length,
      /** Parts the server has a model for that this app is too old to run. */
      needsAppUpdate: remote?.needs_app_update ?? [],
      checkedAt: remote?.checked_at ?? null,
    };
  }, [installed, remote]);
}

/** Download progress and per-part failures of the model installer. */
export function useModelProgress() {
  return useModelTransfer();
}

/** The manual "Kiểm tra" button. */
export function useModelCheck() {
  const status = useModelStatus();
  return { ...status, check: () => refreshModels() };
}
