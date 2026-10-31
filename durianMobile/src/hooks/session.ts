import { useMutation } from '@tanstack/react-query';

import { authApi, queryClient, syncApi } from '@/api';
import { getProviderCredential } from '@/services/authProvider';
import { unregisterModelPush } from '@/services/pushRegistration';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useAppContext, useContextStore } from '@/stores/contextStore';
import { useDraftStore } from '@/stores/draftStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { discardAllScans } from '@/sync';
import type { AuthProvider } from '@/types';

import { qk } from './queryKeys';
import { contextFromSnapshot } from './snapshot';

/**
 * Exchanges a Google or Apple token for a session, then downloads the snapshot. If the account
 * already has data (a new phone, FR-X04) the context is restored from it and setup is skipped.
 */
export function useSignIn() {
  return useMutation({
    mutationFn: async ({ provider }: { provider: AuthProvider }) => {
      const { idToken, displayName } = await getProviderCredential(provider);
      const session = await authApi.exchange(provider, idToken, displayName);
      await useAuthStore.getState().signIn(session);
      // The language chosen on SC-01 follows the account. Best effort: it never blocks sign-in.
      const locale = useSettingsStore.getState().locale;
      if (locale) void authApi.setLocale(locale).catch(() => undefined);
      const snapshot = await syncApi.snapshot();
      queryClient.setQueryData(qk.snapshot(session.user.id), snapshot);
      const ctx = contextFromSnapshot(snapshot);
      if (ctx.farmId) useContextStore.getState().select(ctx);
      return session;
    },
  });
}

/**
 * Ends the session and drops everything cached for it. Scans still on the phone stay, filed under
 * this account, so signing in again finds them. Pass `discardScans` only after the farmer was told
 * how many would be lost (`SignOutDialog`, FR-X10).
 */
export async function logout({ discardScans = false }: { discardScans?: boolean } = {}) {
  const userId = useAuthStore.getState().user?.id;
  if (discardScans && userId) await discardAllScans(userId);
  // Revoke the session server-side while the token is still attached. Best effort: offline or an
  // already-expired session must not trap the farmer in the app.
  if (useAuthStore.getState().token) {
    await unregisterModelPush();
    await authApi.logout().catch(() => undefined);
  }
  await useAuthStore.getState().signOut();
  useChatStore.getState().clear();
  queryClient.clear();
}

export type AuthGate = 'signedOut' | 'setup' | 'ready';

/** `signedOut` → SC-01, `setup` → SC-02 (no farm yet), `ready` → the tabs. */
export function useAuthGate(): AuthGate {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const ctx = useAppContext();
  if (!token || !user) return 'signedOut';
  return ctx.farmId ? 'ready' : 'setup';
}

/**
 * Deletes the account on the server, then everything this phone holds for it (FR-X09). The server
 * call comes first: if it fails nothing local is touched and the farmer can try again. Signing out
 * last drops the token, which ends the session.
 */
export async function deleteAccount() {
  const userId = useAuthStore.getState().user?.id;
  await authApi.deleteAccount();
  if (userId) {
    await discardAllScans(userId);
    useDraftStore.setState((s) => {
      const { [userId]: _gone, ...rest } = s.drafts;
      return { drafts: rest };
    });
    useContextStore.setState((s) => {
      const { [userId]: _gone, ...rest } = s.byUser;
      return { byUser: rest };
    });
  }
  await logout();
}
