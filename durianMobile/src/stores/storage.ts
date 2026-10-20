import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** One MMKV instance for non-sensitive app state. Secrets go to `expo-secure-store`. */
export const mmkv = createMMKV({ id: 'durian' });

/** Synchronous zustand `persist` storage, so persisted stores are hydrated when they are created. */
export const zustandStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => {
    mmkv.remove(name);
  },
};
