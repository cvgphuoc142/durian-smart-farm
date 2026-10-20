import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';

import { useIsOnline } from './useIsOnline';

/**
 * Online-only buttons (everything except Scan, FR-X05). Offline, the tap shows why nothing happened
 * and the form keeps what was typed; nothing is queued or sent later.
 */
export function useRequireOnline() {
  const online = useIsOnline();
  const toast = useToast();
  const { t } = useTranslation();
  const guard = useCallback(
    <A extends unknown[]>(action: (...args: A) => void) =>
      (...args: A) => {
        if (online) action(...args);
        else toast.show(t('errors.needsNetwork'), 'error');
      },
    [online, toast, t],
  );
  return { online, guard };
}
