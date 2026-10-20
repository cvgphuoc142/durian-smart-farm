import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { scanRepo } from '@/db';
import { startRefsPersistence, useIsOnline, patchSnapshot, useUserId } from '@/hooks';
import { defaultDeps, onSyncRequest, runOutbox } from '@/sync';

/**
 * Mounted once. Sends the saved scans when the app opens, when the network comes back, when the
 * app returns to the foreground, and right after a save (FR-X06). Renders nothing.
 */
export function ScanSyncHost() {
  const client = useQueryClient();
  const userId = useUserId();
  const online = useIsOnline();
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => startRefsPersistence(client), [client]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const run = () => {
      if (!alive || !onlineRef.current) return;
      void runOutbox(userId, {
        ...defaultDeps,
        onAcknowledged: (rows) => patchSnapshot(client, userId, rows),
      }).catch(() => undefined);
    };
    // A crash mid-send leaves nothing "sending".
    void scanRepo.resetSending(userId).then(run, run);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    const off = onSyncRequest(run);
    return () => {
      alive = false;
      sub.remove();
      off();
    };
  }, [client, userId]);

  useEffect(() => {
    if (!userId || !online) return;
    void runOutbox(userId, {
      ...defaultDeps,
      onAcknowledged: (rows) => patchSnapshot(client, userId, rows),
    }).catch(() => undefined);
  }, [client, userId, online]);

  return null;
}
