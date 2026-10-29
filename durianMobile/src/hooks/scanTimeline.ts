import { useMemo } from 'react';

import { mergeCases, mergeScans, partLabel } from '@/sync/timeline';

import { useScanModels } from './models';
import { useLocalScans } from './scan';
import { live, useSnapshot } from './snapshot';
import { useFormat } from './useFormat';

/**
 * Scans and cases for SC-15 and SC-16: what the server has, plus what is still only on this
 * phone. Reads the snapshot, so it needs the network once; the sync screen (SC-26) does not.
 */
export function useScanTimeline() {
  const { data } = useSnapshot();
  const { scans: local } = useLocalScans();
  return useMemo(() => {
    const scans = mergeScans(data.scans, local);
    const cases = mergeCases(live(data.disease_cases), local, scans);
    return { scans, cases };
  }, [data.scans, data.disease_cases, local]);
}

/** Body-part names in the UI language. */
export function usePartLabel() {
  const { entries } = useScanModels();
  const { locale } = useFormat();
  return (part: string) => partLabel(entries, part, locale);
}
