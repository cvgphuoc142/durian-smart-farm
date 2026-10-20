import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { currentUserId } from './authStore';
import { zustandStorage } from './storage';

/**
 * `expense`, `sale`, `payment`, `careLog`, `farmSetup`, `chat`, … For a record being edited use
 * `draftKey('expense', id)` so two edits do not share one draft.
 */
export type DraftKey = string;

export const draftKey = (form: string, id?: string | null): DraftKey =>
  id ? `${form}:${id}` : form;

interface DraftState {
  /** `userId` → draft key → values. */
  drafts: Record<string, Record<DraftKey, Record<string, unknown>>>;
  saveDraft: (key: DraftKey, values: Record<string, unknown>) => void;
  clearDraft: (key: DraftKey) => void;
}

/** Unsaved form values, kept across restarts and failed submits. Dates are stored as ISO strings. */
export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      saveDraft: (key, values) => {
        const userId = currentUserId();
        if (!userId) return;
        set((s) => ({
          drafts: { ...s.drafts, [userId]: { ...s.drafts[userId], [key]: values } },
        }));
      },
      clearDraft: (key) => {
        const userId = currentUserId();
        if (!userId) return;
        set((s) => {
          const { [key]: _removed, ...rest } = s.drafts[userId] ?? {};
          return { drafts: { ...s.drafts, [userId]: rest } };
        });
      },
    }),
    { name: 'drafts', storage: createJSONStorage(() => zustandStorage) },
  ),
);

/** The current account's draft for a form, if any. */
export function getDraft(key: DraftKey): Record<string, unknown> | undefined {
  const userId = currentUserId();
  return userId ? useDraftStore.getState().drafts[userId]?.[key] : undefined;
}
