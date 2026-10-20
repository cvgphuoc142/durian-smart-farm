import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Session, User } from '@/types';

import { zustandStorage } from './storage';

const TOKEN_KEY = 'auth.token';

interface AuthState {
  /** `false` until the token has been read from secure storage. */
  hydrated: boolean;
  token: string | null;
  user: User | null;
  hydrate: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

/** The token lives in the keychain / keystore; only the (non-sensitive) user profile goes to MMKV. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      token: null,
      user: null,
      hydrate: async () => {
        const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
        set({ token, hydrated: true });
      },
      signIn: async ({ token, user }) => {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        set({ token, user });
      },
      signOut: async () => {
        set({ token: null, user: null });
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ user }) => ({ user }),
    },
  ),
);

/** The signed-in account's id, or `null`. Everything stored per account is keyed by it. */
export const currentUserId = () => useAuthStore.getState().user?.id ?? null;
