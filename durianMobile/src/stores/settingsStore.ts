import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Locale } from '@/types';

import { zustandStorage } from './storage';

export type { Locale };

interface SettingsState {
  /** `null` until the user picks one; the device language is used until then. */
  locale: Locale | null;
  setLocale: (locale: Locale) => void;
}

/** Device-level choices that survive sign-out. Per-account data does not belong here. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: null,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ locale }) => ({ locale }),
    },
  ),
);
