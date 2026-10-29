import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { installModels, isOnCellular, megabytes, type ModelEntry, useModelTransfer } from '@/ai';
import { ConfirmDialog, useToast } from '@/components/ui';
import { useRequireOnline } from '@/hooks';
import { registerForModelPush } from '@/services/pushRegistration';

/**
 * Starts the download of models. On mobile data it first says how much will be used and waits for
 * a second tap. After the first successful install it offers notifications, once, so the farmer
 * hears about the next model without opening the app.
 */
export function useModelInstaller() {
  const { t } = useTranslation();
  const toast = useToast();
  const { online } = useRequireOnline();
  const [pending, setPending] = useState<ModelEntry[] | null>(null);

  const run = useCallback(async (entries: ModelEntry[]) => {
    await installModels(entries);
    const { errors } = useModelTransfer.getState();
    if (entries.every((e) => !errors[e.plant_part])) void registerForModelPush({ ask: true });
  }, []);

  const start = useCallback(
    async (entries: ModelEntry[]) => {
      if (entries.length === 0) return;
      if (!online) {
        toast.show(t('errors.needsNetwork'), 'error');
        return;
      }
      if (await isOnCellular()) setPending(entries);
      else void run(entries);
    },
    [online, run, t, toast],
  );

  const bytes = pending?.reduce((n, e) => n + e.artifact.size_bytes, 0) ?? 0;
  const dialog = (
    <ConfirmDialog
      visible={pending != null}
      title={t('models.cellularTitle')}
      message={t('models.cellularBody', { size: megabytes(bytes) })}
      confirmLabel={t('models.download')}
      onConfirm={() => {
        const entries = pending;
        setPending(null);
        if (entries) void run(entries);
      }}
      onCancel={() => setPending(null)}
    />
  );
  return { start, dialog };
}
