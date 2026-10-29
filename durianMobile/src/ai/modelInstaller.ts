import { create } from 'zustand';

import { modelsApi } from '@/api/endpoints/models';

import type { ModelEntry } from './manifest';
import { modelFiles, type ModelFiles } from './modelFiles';
import { isSameModelFile, useModelStore } from './modelStore';

export type InstallErrorCode =
  'no_space' | 'network' | 'changed' | 'size_mismatch' | 'hash_mismatch' | 'cancelled' | 'unknown';

export class ModelInstallError extends Error {
  constructor(readonly code: InstallErrorCode) {
    super(code);
  }
}

export type TransferPhase = 'downloading' | 'verifying';

interface TransferState {
  /** The model being fetched right now. */
  active: { part: string; phase: TransferPhase; done: number; total: number } | null;
  /** Parts waiting their turn. */
  queue: string[];
  /** Why the last attempt for a part failed; cleared when it is tried again. */
  errors: Record<string, InstallErrorCode>;
}

export const useModelTransfer = create<TransferState>(() => ({
  active: null,
  queue: [],
  errors: {},
}));

const set = (patch: Partial<TransferState>) => useModelTransfer.setState(patch);

/** Where a model lives under the document folder. */
export const modelPath = (entry: ModelEntry) =>
  `models/${clean(entry.model_id)}/${clean(entry.version)}.onnx`;
const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');

/** Room for the file plus a margin; a full disk fails late and leaves a half file. */
const SPACE_MARGIN = 50_000_000;

let cancelCurrent: (() => Promise<void>) | null = null;
let cancelled = false;

/** Stops the download in progress. Models already installed are untouched. */
export async function cancelInstall() {
  cancelled = true;
  waiting.clear();
  set({ queue: [] });
  await cancelCurrent?.().catch(() => undefined);
}

async function install(entry: ModelEntry, files: ModelFiles) {
  const part = entry.plant_part;
  const store = useModelStore.getState();
  const total = entry.artifact.size_bytes;

  // The version the farmer rolled back from is still on the phone: switching back costs nothing.
  const held = store.installed[part]?.previous;
  if (held && isSameModelFile(held.entry, entry) && files.exists(held.file)) {
    store.rollback(part);
    return;
  }

  if (files.freeBytes() < total + SPACE_MARGIN) throw new ModelInstallError('no_space');

  const info = await modelsApi.download(entry.model_id, entry.version).catch((e) => {
    // 404: the server moved on to another version after the last check.
    throw new ModelInstallError((e as { status?: number })?.status === 404 ? 'changed' : 'network');
  });
  if (info.sha256 !== entry.artifact.sha256 || info.size_bytes !== total) {
    throw new ModelInstallError('changed');
  }

  const final = modelPath(entry);
  const partial = `${final}.part`;
  files.remove(partial);
  set({ active: { part, phase: 'downloading', done: 0, total } });

  try {
    const task = files.download(info.url, partial, (done, expected) =>
      set({
        active: { part, phase: 'downloading', done, total: expected > 0 ? expected : total },
      }),
    );
    cancelCurrent = task.cancel;
    let status: number;
    try {
      status = await task.done;
    } catch {
      throw new ModelInstallError(cancelled ? 'cancelled' : 'network');
    } finally {
      cancelCurrent = null;
    }
    if (status !== 200) throw new ModelInstallError('network');
    if (files.sizeOf(partial) !== total) throw new ModelInstallError('size_mismatch');

    set({ active: { part, phase: 'verifying', done: 0, total } });
    const digest = await files.sha256(partial, (done, of) =>
      set({ active: { part, phase: 'verifying', done, total: of } }),
    );
    if (digest !== entry.artifact.sha256) throw new ModelInstallError('hash_mismatch');

    files.move(partial, final);
  } catch (e) {
    files.remove(partial);
    throw e;
  }

  const { dropped } = store.install({ entry, file: final, installed_at: new Date().toISOString() });
  // Two generations are kept (in use + one to go back to); anything older goes.
  if (dropped && dropped.file !== final) files.remove(dropped.file);
}

let running: Promise<void> | null = null;
/** Entries waiting for their turn, by body part (a later call may add to a run in progress). */
const waiting = new Map<string, ModelEntry>();

/**
 * Downloads the given models one after the other and installs each only after its size and
 * sha256 match the manifest. A failure is recorded per body part and does not stop the others.
 * The model in use is never touched until the new file has been verified.
 */
export function installModels(entries: readonly ModelEntry[], files: ModelFiles = modelFiles) {
  const state = useModelTransfer.getState();
  const queued = new Set(state.queue);
  const fresh = entries.filter(
    (e) => !queued.has(e.plant_part) && state.active?.part !== e.plant_part,
  );
  const errors = { ...state.errors };
  for (const e of fresh) {
    delete errors[e.plant_part];
    waiting.set(e.plant_part, e);
  }
  set({ queue: [...queued, ...fresh.map((e) => e.plant_part)], errors });

  running ??= (async () => {
    cancelled = false;
    try {
      for (;;) {
        const { queue } = useModelTransfer.getState();
        const part = queue[0];
        if (!part) break;
        set({ queue: queue.slice(1) });
        const entry = waiting.get(part);
        waiting.delete(part);
        if (!entry) continue;
        try {
          await install(entry, files);
        } catch (e) {
          const code = e instanceof ModelInstallError ? e.code : 'unknown';
          set({ errors: { ...useModelTransfer.getState().errors, [part]: code } });
        } finally {
          set({ active: null });
        }
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Goes back to the previous model of a body part. False when there is none. */
export function rollbackModel(part: string, files: ModelFiles = modelFiles): boolean {
  const prev = useModelStore.getState().installed[part]?.previous;
  if (!prev || !files.exists(prev.file)) return false;
  return useModelStore.getState().rollback(part);
}
