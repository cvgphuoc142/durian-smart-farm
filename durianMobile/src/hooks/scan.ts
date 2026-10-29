import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { engine, type ModelEntry } from '@/ai';
import { syncApi } from '@/api';
import { onScanChange, readRefs, refsFromSnapshot, scanRepo, writeRefs, type ScanRefs } from '@/db';
import { useAuthStore } from '@/stores/authStore';
import type { RunContext } from '@/sync';
import type { Locale, LocalScan, Snapshot } from '@/types';

import { useScanModels } from './models';
import { qk, useUserId } from './queryKeys';

/** Re-reads a local table whenever a scan changes (save, sync step, discard). */
function useLocal<T>(load: (userId: string) => Promise<T>, empty: T) {
  const userId = useUserId();
  const [value, setValue] = useState<{ userId: string | null; data: T; ready: boolean }>({
    userId,
    data: empty,
    ready: false,
  });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const read = () =>
      loadRef.current(userId).then(
        (data) => alive && setValue({ userId, data, ready: true }),
        () => alive && setValue({ userId, data: empty, ready: true }),
      );
    void read();
    const off = onScanChange(() => void read());
    return () => {
      alive = false;
      off();
    };
    // `empty` is a constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Never hand one account the rows read for another.
  return value.userId === userId ? value : { userId, data: empty, ready: false };
}

const NONE: LocalScan[] = [];

/** Scans on this phone, newest first, drafts included. Works offline. */
export function useLocalScans() {
  const { data, ready } = useLocal(scanRepo.listScans, NONE);
  return { scans: data, ready };
}

/** One local scan by id, or `null` once it is gone. `undefined` while loading. */
export function useLocalScan(id: string) {
  const { scans, ready } = useLocalScans();
  return useMemo(
    () => (ready ? (scans.find((s) => s.id === id) ?? null) : undefined),
    [scans, ready, id],
  );
}

/** For the sign-out warning (FR-X10). */
export function useUnsyncedScanCount() {
  return useLocal(scanRepo.countUnsynced, 0).data;
}

/** What the scan flow needs to run a model for the signed-in account in the UI language. */
export function useRunContext(): RunContext | null {
  const userId = useUserId();
  const { i18n } = useTranslation();
  const { entries } = useScanModels();
  const locale: Locale = i18n.language?.startsWith('en') ? 'en' : 'vi';
  return useMemo(
    () => (userId ? { userId, entries: entries as ModelEntry[], engine, locale } : null),
    [userId, entries, locale],
  );
}

/**
 * Farms, plots, seasons and open cases to save a scan into. Uses the live snapshot when there is
 * one and the copy kept on the phone otherwise, so saving works without a network (FR-B06).
 */
export function useScanTargets(): { refs: ScanRefs | null; fromCache: boolean; loading: boolean } {
  const userId = useUserId();
  const snapshot = useQuery({
    queryKey: qk.snapshot(userId),
    queryFn: syncApi.snapshot,
    enabled: userId != null,
    retry: false,
  });
  const [cached, setCached] = useState<{ userId: string; refs: ScanRefs | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    readRefs(userId).then(
      (refs) => alive && setCached({ userId, refs }),
      () => alive && setCached({ userId, refs: null }),
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  const live = useMemo(
    () => (snapshot.data ? refsFromSnapshot(snapshot.data) : null),
    [snapshot.data],
  );
  const fromDisk = cached?.userId === userId ? cached.refs : null;
  return {
    refs: live ?? fromDisk,
    fromCache: live == null && fromDisk != null,
    loading: live == null && cached?.userId !== userId,
  };
}

/** Keeps the on-phone copy of the references fresh whenever the snapshot changes. */
export function startRefsPersistence(client: QueryClient) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const off = client.getQueryCache().subscribe((event) => {
    const key = event.query.queryKey;
    if (key[1] !== 'snapshot' || event.type !== 'updated') return;
    const data = event.query.state.data as Snapshot | undefined;
    const userId = key[0] as string;
    if (!data || userId === 'anon') return;
    clearTimeout(timers.get(userId));
    timers.set(
      userId,
      setTimeout(() => void writeRefs(userId, refsFromSnapshot(data)).catch(() => undefined), 500),
    );
  });
  return () => {
    off();
    timers.forEach(clearTimeout);
  };
}

/** The signed-in account's id, for non-hook callers (the sign-out flow). */
export const currentScanUserId = () => useAuthStore.getState().user?.id ?? null;
