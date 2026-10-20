import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button, Chip, ChipRow, InfoBanner, Screen, Text } from '@/components/ui';
import { useSignIn } from '@/hooks';
import { setLocale } from '@/i18n';
import { SignInCancelled } from '@/services/authProvider';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme';
import type { AuthProvider } from '@/types';

/**
 * SC-01: pick the language, then sign in with Google (both platforms) or Apple (iOS only). The
 * language is stored on the phone straight away, so it survives a failed sign-in. On a new phone the
 * same Google account brings the data back through the snapshot (FR-X04); the gate then skips SC-02.
 */
export function SignIn() {
  const { t, i18n } = useTranslation();
  const signIn = useSignIn();
  const stored = useSettingsStore((s) => s.locale);
  const current = stored ?? (i18n.language === 'en' ? 'en' : 'vi');

  const start = (provider: AuthProvider) => signIn.mutate({ provider });
  const failure = signIn.error;
  const cancelled = failure instanceof SignInCancelled;
  const notConfigured = failure instanceof Error && failure.message === 'auth_not_configured';

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}>
      <View testID="screen-SignIn" style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="pageTitle" accessibilityRole="header">
            {t('signIn.welcome')}
          </Text>
          <Text color="textMuted">{t('signIn.intro')}</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('signIn.language')}</Text>
          <ChipRow>
            <Chip
              label={t('settings.vi')}
              selected={current === 'vi'}
              onPress={() => void setLocale('vi')}
            />
            <Chip
              label={t('settings.en')}
              selected={current === 'en'}
              onPress={() => void setLocale('en')}
            />
          </ChipRow>
        </View>

        {failure && !cancelled ? (
          <InfoBanner
            tone="danger"
            text={notConfigured ? t('signIn.notConfigured') : t('signIn.failed')}
          />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('signIn.google')}
            loading={signIn.isPending && signIn.variables?.provider === 'google'}
            disabled={signIn.isPending}
            onPress={() => start('google')}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label={t('signIn.apple')}
              variant="outline"
              loading={signIn.isPending && signIn.variables?.provider === 'apple'}
              disabled={signIn.isPending}
              onPress={() => start('apple')}
            />
          ) : null}
        </View>

        <Text variant="caption" color="textMuted">
          {t('signIn.restoreNote')}
        </Text>
      </View>
    </Screen>
  );
}
