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
import { DELETION_REQUEST_URL } from '@/config';
import {
  deleteAccount,
  logout,
  useIsOnline,
  useRequireOnline,
  useUnsyncedScanCount,
} from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import { requestSync } from '@/sync';
import { spacing } from '@/theme';

type Dialog = 'signOut' | 'delete' | null;

/**
 * SC-27: who is signed in, sign out / switch account, and account deletion. Signing out with scans
 * that never reached the server offers to send them first (FR-X10). Deleting works from inside the
 * app, and there is a web link for a farmer who can no longer open it (FR-X09).
 */
export function Account() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const unsynced = useUnsyncedScanCount();
  const online = useIsOnline();
  const { guard } = useRequireOnline();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
    } catch {
      setDeleting(false);
      close();
      toast.show(t('account.deleteFailed'), 'error');
    }
  };

  const requestDeletion = async () => {
    if (!(await openExternal(DELETION_REQUEST_URL))) toast.show(t('settings.linkFailed'), 'error');
  };

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
          <Text variant="secondary" color="textMuted" style={{ marginBottom: spacing.md }}>
            {t('account.deleteHint')}
          </Text>
          {!online ? (
            <InfoBanner tone="warning" icon="wifiOff" text={t('account.deleteOffline')} />
          ) : null}
          <Button
            label={t('account.delete')}
            variant="danger"
            onPress={guard(() => setDialog('delete'))}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label={t('account.requestDeletion')}
            variant="ghost"
            onPress={() => void requestDeletion()}
            style={{ marginTop: spacing.sm }}
          />
        </Section>

        <SignOutDialog
          visible={dialog === 'signOut'}
          unsyncedScans={unsynced}
          onSyncFirst={sendFirst}
          onConfirm={() => void signOut()}
          onCancel={close}
        />
        <ConfirmDialog
          visible={dialog === 'delete'}
          destructive
          title={t('account.deleteTitle')}
          message={
            unsynced > 0
              ? t('account.deleteBodyUnsynced', { count: unsynced })
              : t('account.deleteBody')
          }
          confirmLabel={t('account.deleteConfirm')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => (deleting ? undefined : close())}
        />
      </View>
    </Screen>
  );
}
