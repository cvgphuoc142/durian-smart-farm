import { create } from 'zustand';

import type { ChatMessage } from '@/types';

import { currentUserId } from './authStore';

interface ChatState {
  /** `userId` → the conversation of this session. Kept in memory only: nothing of it is stored. */
  byUser: Record<string, ChatMessage[]>;
  add: (message: ChatMessage) => void;
  clear: () => void;
}

const NONE: ChatMessage[] = [];

export const useChatStore = create<ChatState>()((set) => ({
  byUser: {},
  add: (message) => {
    const userId = currentUserId();
    if (!userId) return;
    set((s) => ({ byUser: { ...s.byUser, [userId]: [...(s.byUser[userId] ?? NONE), message] } }));
  },
  clear: () => set({ byUser: {} }),
}));

/** The signed-in account's messages, oldest first. */
export function useChatMessages(): ChatMessage[] {
  return useChatStore((s) => {
    const userId = currentUserId();
    return (userId && s.byUser[userId]) || NONE;
  });
}
