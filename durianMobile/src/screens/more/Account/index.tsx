import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SignOutDialog } from '@/components/domain';
import {
  Button,
  Card,
  Header,
  InfoBanner,
  Screen,
  Section,
  Text,
  useToast,
} from '@/components/ui';
import { logout, useUnsyncedScanCount } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useAuthStore } from '@/stores/authStore';
import { requestSync } from '@/sync';
import { spacing } from '@/theme';

type Dialog = 'signOut' | null;

/**
 * SC-27: who is signed in and sign out / switch account. Signing out with scans that never reached
 * the server offers to send them first (FR-X10).
 */
export function Account() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const unsynced = useUnsyncedScanCount();
  const [dialog, setDialog] = useState<Dialog>(null);

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
