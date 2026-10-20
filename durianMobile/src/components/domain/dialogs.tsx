import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui';
import { formatVND } from '@/utils';

/** Deleting a care entry that has a cost deletes the cost too (FR-A10), so the farmer must see that. */
export function DeleteCareLogDialog({
  visible,
  expenseAmount,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  /** The linked expense, or `null` when the entry has none. */
  expenseAmount: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const amount = formatVND(expenseAmount, i18n.language === 'en' ? 'en' : 'vi');
  return (
    <ConfirmDialog
      visible={visible}
      destructive
      title={t('dialogs.deleteCareLog.title')}
      message={
        amount
          ? t('dialogs.deleteCareLog.withExpense', { amount })
          : t('dialogs.deleteCareLog.plain')
      }
      confirmLabel={amount ? t('dialogs.deleteCareLog.confirmBoth') : t('common.delete')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/** Signing out or switching account with scans not yet on the server (FR-X10). */
export function SignOutDialog({
  visible,
  unsyncedScans,
  onSyncFirst,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  unsyncedScans: number;
  /** Try to send the waiting scans before signing out. */
  onSyncFirst: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  if (unsyncedScans === 0) {
    return (
      <ConfirmDialog
        visible={visible}
        title={t('dialogs.signOut.title')}
        message={t('dialogs.signOut.plain')}
        confirmLabel={t('dialogs.signOut.confirm')}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }
  return (
    <ConfirmDialog
      visible={visible}
      destructive
      title={t('dialogs.signOut.title')}
      message={t('dialogs.signOut.unsynced', { count: unsyncedScans })}
      confirmLabel={t('dialogs.signOut.discard')}
      cancelLabel={t('dialogs.signOut.syncFirst')}
      onConfirm={onConfirm}
      onCancel={onSyncFirst}
    />
  );
}
