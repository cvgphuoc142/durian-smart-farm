import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { currentUserId, useAuthStore } from './authStore';
import { zustandStorage } from './storage';

/** The farm, plot and season every screen is scoped to (FR-A03). */
export interface AppContext {
  farmId: string | null;
  plotId: string | null;
  seasonId: string | null;
}

const EMPTY: AppContext = { farmId: null, plotId: null, seasonId: null };

interface ContextState {
  /** Per account, so a second Google account on the same phone never inherits the first one's pick. */
  byUser: Record<string, AppContext>;
  set: (ctx: Partial<AppContext>) => void;
  /** Picks a season and moves farm and plot with it. */
  select: (ctx: AppContext) => void;
  clear: () => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      byUser: {},
      set: (ctx) => {
        const userId = currentUserId();
        if (!userId) return;
        set((s) => ({
          byUser: { ...s.byUser, [userId]: { ...(s.byUser[userId] ?? EMPTY), ...ctx } },
        }));
      },
      select: (ctx) => {
        const userId = currentUserId();
        if (!userId) return;
        set((s) => ({ byUser: { ...s.byUser, [userId]: ctx } }));
      },
      clear: () => {
        const userId = currentUserId();
        if (!userId) return;
        set((s) => ({ byUser: { ...s.byUser, [userId]: EMPTY } }));
      },
    }),
    {
      name: 'context',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ byUser }) => ({ byUser }),
    },
  ),
);

/** The context of the signed-in account. */
export function useAppContext(): AppContext {
  const userId = useAuthStore((s) => s.user?.id);
  return useContextStore((s) => (userId ? s.byUser[userId] : undefined)) ?? EMPTY;
}
