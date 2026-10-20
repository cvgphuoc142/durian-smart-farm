import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import { getDraft, useDraftStore, type DraftKey } from '@/stores/draftStore';

const SAVE_DELAY_MS = 400;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

/** Dates become ISO strings in storage; turn them back into `Date`s for the form. */
function revive(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      typeof v === 'string' && ISO_DATE.test(v) ? new Date(v) : v,
    ]),
  );
}

/**
 * Keeps a form's unsaved values in `draftStore`: restores them on mount, saves (debounced) while
 * the form is dirty, and exposes `clear` for after a successful submit.
 */
export function useFormDraft<T extends FieldValues>(
  key: DraftKey,
  form: UseFormReturn<T>,
  onRestore?: () => void,
) {
  const { reset, watch } = form;
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = getDraft(key);
    if (draft) {
      // Keep the defaults, so the restored values count as "dirty" and the unsaved-changes guard stays armed.
      reset(revive(draft) as unknown as T, { keepDefaultValues: true });
      onRestore?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(
        () => useDraftStore.getState().saveDraft(key, values as Record<string, unknown>),
        SAVE_DELAY_MS,
      );
    });
    return () => {
      clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [key, watch]);

  return {
    clear: () => useDraftStore.getState().clearDraft(key),
  };
}
