import { useCallback } from 'react';

import { authApi } from '@/api';
import { setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import type { Locale } from '@/types';

/**
 * Switches the UI language. It works offline and only changes text: ids, money, notes and ticks are
 * stored language-free (FR-X03). The account's copy of the choice is updated on a best-effort basis;
 * if that call fails the phone still has the choice and the next sign-in sends it again.
 */
export function useChangeLocale() {
  return useCallback(async (locale: Locale) => {
    await setLocale(locale);
    if (useAuthStore.getState().token) void authApi.setLocale(locale).catch(() => undefined);
  }, []);
}
