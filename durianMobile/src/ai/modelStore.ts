import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/stores/storage';

import { modelEntrySchema, parseManifest, type ModelEntry } from './manifest';

/** A model file on the phone and the manifest entry it came with. */
export interface InstalledModel {
  entry: ModelEntry;
  /** Path under the app's document folder, so it survives the container moving. */
  file: string;
  installed_at: string;
}

/** The model in use for a body part and the one before it, kept so the farmer can go back. */
export interface InstalledPart {
  current: InstalledModel;
  previous: InstalledModel | null;
}

/** What the server offered at the last successful check. */
export interface RemoteModels {
  revision: string | null;
  entries: ModelEntry[];
  /** Body parts the server offers that this app is too old to run. */
  needs_app_update: string[];
  checked_at: string;
}

interface ModelState {
  installed: Record<string, InstalledPart>;
  remote: RemoteModels | null;
  setRemote: (remote: RemoteModels) => void;
  /** Makes `model` the one in use; the one it replaces becomes the rollback copy. */
  install: (model: InstalledModel) => { dropped: InstalledModel | null };
  /** Swaps in the rollback copy. Returns false when there is none. */
  rollback: (part: string) => boolean;
  /** Refreshes the texts of a model already on the phone (notes, beta flag, limits). */
  patchEntry: (part: string, which: 'current' | 'previous', entry: ModelEntry) => void;
}

const sameFile = (a: ModelEntry, b: ModelEntry) =>
  a.model_id === b.model_id && a.version === b.version && a.artifact.sha256 === b.artifact.sha256;
export { sameFile as isSameModelFile };

function reviveModel(raw: unknown): InstalledModel | null {
  const m = raw as Partial<InstalledModel> | null;
  const entry = modelEntrySchema.safeParse(m?.entry);
  if (!entry.success || typeof m?.file !== 'string') return null;
  return { entry: entry.data, file: m.file, installed_at: String(m.installed_at ?? '') };
}

/** Rebuilds the persisted state, dropping anything the current schema would not accept. */
function revive(raw: unknown): Pick<ModelState, 'installed' | 'remote'> {
  const p = (raw ?? {}) as { installed?: Record<string, unknown>; remote?: Partial<RemoteModels> };
  const installed: Record<string, InstalledPart> = {};
  for (const [part, value] of Object.entries(p.installed ?? {})) {
    const v = value as { current?: unknown; previous?: unknown };
    const current = reviveModel(v?.current);
    if (current) installed[part] = { current, previous: reviveModel(v?.previous) };
  }
  let remote: RemoteModels | null = null;
  if (p.remote && typeof p.remote.checked_at === 'string') {
    remote = {
      revision: p.remote.revision ?? null,
      entries: parseManifest({ schema_version: 1, entries: p.remote.entries ?? [] }).entries,
      needs_app_update: p.remote.needs_app_update ?? [],
      checked_at: p.remote.checked_at,
    };
  }
  return { installed, remote };
}

/**
 * Device-level, like the language: the models belong to the phone, not to an account, and stay when
 * someone signs out. Only the bookkeeping is here; the files are in the document folder.
 */
export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      installed: {},
      remote: null,
      setRemote: (remote) => set({ remote }),
      install: (model) => {
        const part = model.entry.plant_part;
        const old = get().installed[part];
        let dropped: InstalledModel | null = null;
        let previous: InstalledModel | null = null;
        if (old) {
          if (sameFile(old.current.entry, model.entry)) {
            previous = old.previous; // the same file again: nothing to demote
          } else {
            previous = old.current;
            dropped =
              old.previous && !sameFile(old.previous.entry, model.entry) ? old.previous : null;
          }
        }
        set((s) => ({ installed: { ...s.installed, [part]: { current: model, previous } } }));
        return { dropped };
      },
      rollback: (part) => {
        const old = get().installed[part];
        if (!old?.previous) return false;
        set((s) => ({
          installed: { ...s.installed, [part]: { current: old.previous!, previous: old.current } },
        }));
        return true;
      },
      patchEntry: (part, which, entry) =>
        set((s) => {
          const old = s.installed[part];
          const slot = old?.[which];
          if (!old || !slot) return s;
          return {
            installed: { ...s.installed, [part]: { ...old, [which]: { ...slot, entry } } },
          };
        }),
    }),
    {
      name: 'models',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ installed, remote }) => ({ installed, remote }),
      merge: (persisted, current) => ({ ...current, ...revive(persisted) }),
    },
  ),
);
