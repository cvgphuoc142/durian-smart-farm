import { useQueryClient } from '@tanstack/react-query';
import { useCallback, type ReactNode } from 'react';

import { ScreenRefreshProvider } from '@/components/ui';
import { refreshContent } from '@/content';

/**
 * Gives every scrolling `Screen` its pull-to-refresh: re-fetch what the open screens show from the
 * server and look for a newer content release. Failures keep the data already on screen.
 */
export function PullRefreshHost({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const refresh = useCallback(
    () => Promise.allSettled([client.refetchQueries({ type: 'active' }), refreshContent()]),
    [client],
  );
  return <ScreenRefreshProvider value={refresh}>{children}</ScreenRefreshProvider>;
}
