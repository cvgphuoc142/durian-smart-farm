import { useAuthStore } from '@/stores/authStore';

/** Every cache key starts with the user id, so switching accounts never shows the previous one's data. */
export const qk = {
  snapshot: (userId: string | null) => [userId ?? 'anon', 'snapshot'] as const,
  me: (userId: string | null) => [userId ?? 'anon', 'me'] as const,
  content: (userId: string | null, ...rest: (string | number)[]) =>
    [userId ?? 'anon', 'content', ...rest] as const,
};

export function useUserId() {
  return useAuthStore((s) => s.user?.id ?? null);
}
