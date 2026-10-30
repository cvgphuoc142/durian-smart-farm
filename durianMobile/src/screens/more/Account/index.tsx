import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SignOutDialog } from '@/components/domain';
import {
  Button,
  Card,
  ConfirmDialog,
  Header,
  InfoBanner,
  Screen,
  Section,
  Text,
  useToast,
} from '@/components/ui';
import { deleteAccount, logout, useRequireOnline, useUnsyncedScanCount } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useAuthStore } from '@/stores/authStore';
import { requestSync } from '@/sync';
import { spacing } from '@/theme';

type Dialog = 'signOut' | 'delete' | null;

/**
 * SC-27: who is signed in, sign out / switch account, and delete the account. Signing out with scans
 * that never reached the server offers to send them first (FR-X10). Deleting needs the network and
 * removes the account on the server and on this phone (FR-X09).
 */
export function Account() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const unsynced = useUnsyncedScanCount();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const { guard } = useRequireOnline();

  const close = () => setDialog(null);

  const signOut = async () => {
    close();
    await logout({ discardScans: unsynced > 0 });
  };

  const sendFirst = () => {
    close();
    void requestSync();
    toast.show(t('account.sendingScans'), 'info');
  };

  const removeAccount = async () => {
    close();
    setDeleting(true);
    try {
      await deleteAccount();
      toast.show(t('account.deleted'), 'success');
    } catch {
      setDeleting(false);
      toast.show(t('account.deleteFailed'), 'error');
    }
  };

  const deleteBody =
    unsynced > 0
      ? `${t('account.deleteBody')} ${t('account.deleteUnsynced', { count: unsynced })}`
      : t('account.deleteBody');

  const provider = user ? t(`account.${user.provider}`) : '';

  return (
    <Screen
      header={<Header title={t('screens.Account')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-Account" style={{ gap: spacing.lg }}>
        <Card>
          <Text variant="cardTitle">{user?.display_name ?? t('account.noName')}</Text>
          <Text color="textMuted">{t('account.signedInWith', { provider })}</Text>
          <Text variant="secondary" color="textMuted" style={{ marginTop: spacing.sm }}>
            {t('account.restoreNote')}
          </Text>
        </Card>

        {unsynced > 0 ? (
          <InfoBanner tone="warning" text={t('account.unsyncedWarning', { count: unsynced })} />
        ) : null}

        <Section title={t('account.signOut')} flush>
          <Button
            label={t('account.signOut')}
            variant="outline"
            icon="logout"
            onPress={() => setDialog('signOut')}
          />
          <Button
            label={t('account.switch')}
            variant="ghost"
            onPress={() => setDialog('signOut')}
            style={{ marginTop: spacing.sm }}
          />
        </Section>

        <Section title={t('account.delete')} flush>
          <Button
            label={t('account.delete')}
            variant="danger"
            icon="trash"
            loading={deleting}
            disabled={deleting}
            onPress={guard(() => setDialog('delete'))}
          />
        </Section>

        <ConfirmDialog
          visible={dialog === 'delete'}
          title={t('account.deleteTitle')}
          message={deleteBody}
          confirmLabel={t('account.deleteConfirm')}
          destructive
          onConfirm={() => void removeAccount()}
          onCancel={close}
        />

        <SignOutDialog
          visible={dialog === 'signOut'}
          unsyncedScans={unsynced}
          onSyncFirst={sendFirst}
          onConfirm={() => void signOut()}
          onCancel={close}
        />
      </View>
    </Screen>
  );
}
