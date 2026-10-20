import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isStale, refreshContent } from '@/content';
import { contentRepo } from '@/db';
import { useIsOnline, useUserId } from '@/hooks';

/**
 * Mounted once. Looks for a newer content release when the app opens, when the network comes
 * back, and when the app returns to the foreground after more than a day (FR-C03). There is no
 * background download: a release is only fetched while the app is in use. Renders nothing.
 */
export function ContentSyncHost() {
  const userId = useUserId();
  const online = useIsOnline();
  const onlineRef = useRef(online);
  onlineRef.current = online;

  // Opening the app signed in, and every time the connection returns.
  useEffect(() => {
    if (userId && online) void refreshContent();
  }, [userId, online]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void contentRepo
        .getMeta()
        .catch(() => null)
        .then((meta) => {
          if (onlineRef.current && isStale(meta)) void refreshContent();
        });
    });
    return () => sub.remove();
  }, [userId]);

  return null;
}
