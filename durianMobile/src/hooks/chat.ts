import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { authApi, chatApi } from '@/api';
import { newId } from '@/api/ids';
import { AI_CONSENT_VERSION } from '@/config';
import { contentRepo } from '@/db';
import { currentUserId } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import type { ChatMessage, ChatResponse, Me } from '@/types';

import { qk, useUserId } from './queryKeys';
import { useSeasonLite } from './standards';
import { useFormat } from './useFormat';
import { useIsOnline } from './useIsOnline';

/** The signed-in account and its consent. Unknown (offline on a cold start) counts as "no consent". */
export function useMe() {
  const userId = useUserId();
  return useQuery<Me>({
    queryKey: qk.me(userId),
    queryFn: authApi.me,
    enabled: userId != null,
    retry: false,
  });
}

/** Whether the farmer agreed to the external AI service (FR-C07). */
export function useAiConsent() {
  const userId = useUserId();
  const client = useQueryClient();
  const me = useMe();
  const set = useMutation({
    mutationFn: (version: number | null) => authApi.setAiConsent(version),
    onSuccess: (preferences) =>
      client.setQueryData<Me>(qk.me(userId), (old) => (old ? { ...old, preferences } : old)),
  });
  return {
    consented: me.data?.preferences.ai_consent_version != null,
    known: me.data != null,
    grant: () => set.mutateAsync(AI_CONSENT_VERSION),
    withdraw: () => set.mutateAsync(null),
    busy: set.isPending,
    error: set.error,
  };
}

/** How many earlier turns go with a question. */
const HISTORY_TURNS = 6;

/**
 * Sends one question to the chatbot. It is online-only and never sent again by itself: a failed
 * question stays a draft the farmer sends by hand, because each send costs a call to the AI
 * service (FR-C07). The cited versions are pinned, so they still open after a later release.
 */
export function useAsk() {
  const online = useIsOnline();
  const { locale } = useFormat();
  const { season, asOf } = useSeasonLite();
  const me = useMe();
  const sending = useRef(false);

  const mutate = useMutation({
    mutationFn: async (question: string): Promise<ChatMessage> => {
      const store = useChatStore.getState();
      const userId = currentUserId();
      const history = ((userId && store.byUser[userId]) || [])
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: m.text }));
      const response: ChatResponse = await chatApi.ask({
        question,
        locale,
        season_id: season?.id,
        history,
        client_last_synced_at: asOf,
      });
      const now = new Date().toISOString();
      store.add({ id: newId(), role: 'user', text: question, created_at: now });
      const reply: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: response.answer,
        created_at: new Date().toISOString(),
        response,
      };
      store.add(reply);
      await contentRepo.pinCitations(response.citations).catch(() => undefined);
      return reply;
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  return {
    ...mutate,
    /** One tap sends once, even if the button is hit twice before the first call started. */
    send: (question: string) => {
      if (sending.current || !online) return Promise.resolve(null);
      sending.current = true;
      return mutate.mutateAsync(question);
    },
    online,
    me,
  };
}
