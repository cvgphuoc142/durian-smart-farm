import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useModelStore } from '@/ai';
import { ModelUpdateBanners } from '@/components/domain/ModelUpdateBanner';
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
import { ENABLED_LOCALES } from '@/config';
import {
  useAiConsent,
  useChangeLocale,
  useContentMeta,
  useContentRefresh,
  useFormat,
  useModelCheck,
  useModelUpdates,
  useRequireOnline,
} from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
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
  const models = useModelCheck();
  const modelUpdates = useModelUpdates();
  const installedCount = useModelStore((s) => Object.keys(s.installed).length);

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

  const checkModels = guard(async () => {
    const result = await models.check();
    toast.show(
      t(
        result === 'update_available'
          ? 'models.checkFound'
          : result === 'up_to_date'
            ? 'models.checkUpToDate'
            : result === 'unsupported'
              ? 'models.checkUnsupported'
              : 'models.checkFailed',
      ),
      result === 'failed' || result === 'unsupported' ? 'error' : 'success',
    );
  });

  return (
    <Screen
      header={<Header title={t('screens.Settings')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ gap: spacing.lg }}
    >
      <View testID="screen-Settings" style={{ gap: spacing.lg }}>
        {ENABLED_LOCALES.length > 1 ? (
          <Section title={t('settings.language')}>
            <Card>
              <ChipRow>
                {ENABLED_LOCALES.map((l) => (
                  <Chip
                    key={l}
                    label={t(`settings.${l}`)}
                    selected={language === l}
                    onPress={() => void changeLocale(l)}
                  />
                ))}
              </ChipRow>
              <Text variant="secondary" color="textMuted" style={{ marginTop: spacing.sm }}>
                {t('settings.languageHint')}
              </Text>
            </Card>
          </Section>
        ) : null}

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

        <Section title={t('settings.models')}>
          <View style={{ gap: spacing.sm }}>
            <Card>
              <Text variant="bodyStrong">
                {installedCount > 0
                  ? t('settings.modelsInstalled', { count: installedCount })
                  : t('settings.modelsNone')}
              </Text>
              {modelUpdates.count > 0 ? (
                <Text variant="secondary" color="textMuted">
                  {t('settings.modelsNew', { count: modelUpdates.count })}
                </Text>
              ) : null}
              {modelUpdates.checkedAt ? (
                <Text variant="secondary" color="textMuted">
                  {t('models.checked', { when: f.dateTime(modelUpdates.checkedAt) })}
                </Text>
              ) : null}
              <Button
                label={models.state === 'checking' ? t('models.checking') : t('models.check')}
                variant="outline"
                icon="refresh"
                loading={models.state === 'checking'}
                onPress={checkModels}
                style={{ marginTop: spacing.md }}
              />
              <Button
                label={t('settings.modelsManage')}
                variant="ghost"
                onPress={() => nav.navigate('Models')}
              />
            </Card>
            <ModelUpdateBanners />
          </View>
        </Section>

        <Section title={t('settings.about')}>
          <ListGroup>
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
