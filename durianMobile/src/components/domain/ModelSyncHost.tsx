import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isModelCheckStale, refreshModels, useModelStore } from '@/ai';
import { useIsOnline, useUserId } from '@/hooks';
import {
  installNotificationHandler,
  onModelNotificationOpened,
  registerForModelPush,
} from '@/services/pushRegistration';

installNotificationHandler();

/**
 * Mounted once, next to `ContentSyncHost`. Asks the server which scan models are published when the
 * app opens, when the network comes back, when the app returns to the foreground after more than a
 * day, and when a "new model" notification is tapped. It only reads the manifest: a model is
 * downloaded when the farmer taps "Tải về", never by itself (and never on mobile data unasked).
 * Renders nothing.
 */
export function ModelSyncHost() {
  const userId = useUserId();
  const online = useIsOnline();
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    if (!userId || !online) return;
    void refreshModels();
    void registerForModelPush();
  }, [userId, online]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const checkedAt = useModelStore.getState().remote?.checked_at;
      if (onlineRef.current && isModelCheckStale(checkedAt)) void refreshModels();
    });
    const off = onModelNotificationOpened(() => {
      if (onlineRef.current) void refreshModels();
    });
    return () => {
      sub.remove();
      off();
    };
  }, [userId]);

  return null;
}
