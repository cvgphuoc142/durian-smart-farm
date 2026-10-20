import { useEffect, useState } from 'react';

import { useAppNavigation } from '@/navigation/useAppNavigation';

/**
 * Closes a form screen after a successful save. The close runs in an effect so the unsaved-changes guard
 * has already been re-armed with `isDirty = false` when `goBack()` fires.
 */
export function useCloseAfterSave() {
  const nav = useAppNavigation();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) nav.goBack();
  }, [saved, nav]);
  return { saved, markSaved: () => setSaved(true) };
}
