import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ChipRow,
  Header,
  InfoBanner,
  ListGroup,
  ListRow,
  Screen,
  Section,
  Text,
  ToggleRow,
  useToast,
} from '@/components/ui';
import { POLICY_URL, SUPPORT_URL } from '@/config';
import {
  useAiConsent,
  useChangeLocale,
  useContentMeta,
  useContentRefresh,
  useFormat,
  useRequireOnline,
} from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal } from '@/services';
import { spacing } from '@/theme';

/**
 * SC-25: language, consent to the external AI service, the content pack and the policy links.
 * The language switch works offline. Changing consent needs the network, like every other write
 * except Scan (FR-X05), and is never queued.
 */
export function Settings() {
  const { t, i18n } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const f = useFormat();
  const changeLocale = useChangeLocale();
  const consent = useAiConsent();
  const { guard } = useRequireOnline();
  const meta = useContentMeta();
  const content = useContentRefresh();
  const language = i18n.language === 'en' ? 'en' : 'vi';

  const toggleConsent = guard(async (on: boolean) => {
    try {
      if (on) await consent.grant();
      else await consent.withdraw();
    } catch {
      toast.show(t('settings.aiFailed'), 'error');
    }
  });

  const refresh = guard(async () => {
    const result = await content.refresh();
    toast.show(
      t(
        result === 'updated'
          ? 'settings.contentUpdated'
          : result === 'up_to_date'
            ? 'settings.contentUpToDate'
            : result === 'unsupported'
              ? 'settings.contentUnsupported'
              : 'settings.contentFailed',
      ),
      result === 'updated' || result === 'up_to_date' ? 'success' : 'error',
    );
  });

  const open = async (url: string) => {
    if (!(await openExternal(url))) toast.show(t('settings.linkFailed'), 'error');
  };

  return (
    <Screen
      header={<Header title={t('screens.Settings')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ gap: spacing.lg }}
    >
      <View testID="screen-Settings" style={{ gap: spacing.lg }}>
        <Section title={t('settings.language')}>
          <Card>
            <ChipRow>
              <Chip
                label={t('settings.vi')}
                selected={language === 'vi'}
                onPress={() => void changeLocale('vi')}
              />
              <Chip
                label={t('settings.en')}
                selected={language === 'en'}
                onPress={() => void changeLocale('en')}
              />
            </ChipRow>
            <Text variant="secondary" color="textMuted" style={{ marginTop: spacing.sm }}>
              {t('settings.languageHint')}
            </Text>
          </Card>
        </Section>

        <Section title={t('settings.ai')}>
          <Card>
            {consent.known ? (
              <ToggleRow
                title={t('settings.aiToggle')}
                hint={t(consent.consented ? 'settings.aiOnHint' : 'settings.aiOffHint')}
                value={consent.consented}
                onValueChange={(on) => {
                  if (!consent.busy) toggleConsent(on);
                }}
              />
            ) : (
              <InfoBanner text={t('settings.aiUnknown')} icon="wifiOff" />
            )}
          </Card>
        </Section>

        <Section title={t('settings.content')}>
          <Card>
            <Text variant="bodyStrong">
              {meta.data
                ? t('settings.contentRelease', { no: meta.data.release_no })
                : t('settings.contentNone')}
            </Text>
            {meta.data ? (
              <Text variant="secondary" color="textMuted">
                {t('settings.contentChecked', { when: f.dateTime(meta.data.checked_at) })}
              </Text>
            ) : null}
            <Button
              label={
                content.state === 'checking'
                  ? t('settings.contentChecking')
                  : t('settings.contentRefresh')
              }
              variant="outline"
              icon="refresh"
              loading={content.state === 'checking'}
              onPress={refresh}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Section>

        <Section title={t('settings.about')}>
          <ListGroup>
            <ListRow title={t('settings.policy')} onPress={() => void open(POLICY_URL)} />
            <ListRow title={t('settings.support')} onPress={() => void open(SUPPORT_URL)} />
            <ListRow
              title={t('settings.version')}
              trailing={<Text color="textMuted">{Constants.expoConfig?.version ?? '—'}</Text>}
            />
          </ListGroup>
        </Section>
      </View>
    </Screen>
  );
}
