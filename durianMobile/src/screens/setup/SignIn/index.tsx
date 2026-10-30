import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button, Chip, ChipRow, InfoBanner, Screen, Text, useToast } from '@/components/ui';
import { ENABLED_LOCALES, PRIVACY_URL } from '@/config';
import { useSignIn } from '@/hooks';
import { setLocale } from '@/i18n';
import { isAppleSignInAvailable, SignInCancelled } from '@/services/authProvider';
import { openExternal } from '@/services/linking';
import { useSettingsStore } from '@/stores/settingsStore';
import { radius, spacing } from '@/theme';
import type { AuthProvider } from '@/types';

/**
 * SC-01: pick the language, then sign in with Apple (iOS) or Google (both platforms). The
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
  const toast = useToast();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void isAppleSignInAvailable().then((ok) => alive && setAppleAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  const openPrivacy = async () => {
    if (!PRIVACY_URL || !(await openExternal(PRIVACY_URL))) {
      toast.show(t('settings.linkFailed'), 'error');
    }
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}>
      <View testID="screen-SignIn" style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="pageTitle" accessibilityRole="header">
            {t('signIn.welcome')}
          </Text>
          <Text color="textMuted">{t('signIn.intro')}</Text>
        </View>

        {ENABLED_LOCALES.length > 1 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('signIn.language')}</Text>
            <ChipRow>
              {ENABLED_LOCALES.map((l) => (
                <Chip
                  key={l}
                  label={t(`settings.${l}`)}
                  selected={current === l}
                  onPress={() => void setLocale(l)}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}

        {failure && !cancelled ? (
          <InfoBanner
            tone="danger"
            text={notConfigured ? t('signIn.notConfigured') : t('signIn.failed')}
          />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel={t('signIn.apple')}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={{ height: 52, opacity: signIn.isPending ? 0.5 : 1 }}
              onPress={() => {
                if (!signIn.isPending) start('apple');
              }}
            />
          ) : null}
          <Button
            label={t('signIn.google')}
            loading={signIn.isPending && signIn.variables?.provider === 'google'}
            disabled={signIn.isPending}
            onPress={() => start('google')}
          />
        </View>

        {PRIVACY_URL ? (
          <Text variant="caption" color="textMuted">
            {t('signIn.privacyPrefix')}
            <Text
              variant="caption"
              color="primary"
              accessibilityRole="link"
              onPress={() => void openPrivacy()}
              style={{ textDecorationLine: 'underline' }}
            >
              {t('signIn.privacyLink')}
            </Text>
            .
          </Text>
        ) : null}

        <Text variant="caption" color="textMuted">
          {t('signIn.restoreNote')}
        </Text>
      </View>
    </Screen>
  );
}
