import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  InfoBanner,
  KeyValueGrid,
  Screen,
  Skeleton,
  Text,
  useToast,
} from '@/components/ui';
import { useContact, useFormat } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal, telUrl, zaloUrl } from '@/services';
import { spacing } from '@/theme';

/**
 * SC-24: one approved contact with the source and the date it was last checked (FR-E02). Calling
 * or opening a link needs the phone or another app, not the app's own connection.
 */
export function ContactDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const toast = useToast();
  const { contactId } = useRoute<RouteProp<RootStackParamList, 'ContactDetail'>>().params;
  const { data: contact, ready } = useContact(contactId);

  const header = (
    <Header title={t('screens.ContactDetail')} variant="back" onBack={() => nav.goBack()} />
  );
  const open = async (url: string) => {
    if (!(await openExternal(url))) toast.show(t('content.cannotOpen'), 'error');
  };

  if (!ready) {
    return (
      <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter }}>
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }
  if (!contact) {
    return (
      <Screen header={header}>
        <View testID="screen-ContactDetail" style={{ paddingHorizontal: spacing.gutter }}>
          <EmptyState icon="users" title={t('contact.gone')} body={t('contact.goneBody')} />
        </View>
      </Screen>
    );
  }

  const expert = contact.kind === 'expert';
  const rows = [
    { label: t('contact.address'), value: contact.address },
    {
      label: t('contact.area'),
      value: [contact.locality, contact.province].filter(Boolean).join(', ') || null,
    },
    { label: t('contact.specialty'), value: contact.specialty },
    { label: t('contact.phone'), value: contact.phone },
  ].filter((r): r is { label: string; value: string } => !!r.value);

  return (
    <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}>
      <View testID="screen-ContactDetail" style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            {contact.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge
              label={t(expert ? 'directory.expert' : 'directory.store')}
              tone={expert ? 'info' : 'neutral'}
            />
            <Badge
              label={
                contact.verified_at
                  ? t('contact.verified', { date: f.day(contact.verified_at) })
                  : t('contact.notVerified')
              }
              tone={contact.verified_at ? 'primary' : 'warning'}
              icon={contact.verified_at ? 'check' : 'alert'}
            />
          </View>
        </View>

        {contact.description ? <Text variant="body">{contact.description}</Text> : null}
        {rows.length > 0 ? (
          <Card>
            <KeyValueGrid items={rows} columns={1} />
          </Card>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {contact.phone ? (
            <Button
              icon="phone"
              label={t('contact.call')}
              onPress={() => void open(telUrl(contact.phone!))}
            />
          ) : null}
          {contact.zalo ? (
            <Button
              variant="outline"
              icon="chat"
              label={t('contact.zalo')}
              onPress={() => void open(zaloUrl(contact.zalo!))}
            />
          ) : null}
          {contact.contact_url ? (
            <Button
              variant="outline"
              icon="globe"
              label={t('contact.openLink')}
              onPress={() => void open(contact.contact_url!)}
            />
          ) : null}
          {contact.source_link ? (
            <Button
              variant="ghost"
              icon="file"
              label={t('contact.source')}
              onPress={() => void open(contact.source_link!)}
            />
          ) : null}
          {!contact.phone && !contact.zalo && !contact.contact_url ? (
            <Text variant="secondary" color="textMuted">
              {t('contact.noWay')}
            </Text>
          ) : null}
        </View>

        <InfoBanner tone="info" text={t('contact.disclaimer')} />
      </View>
    </Screen>
  );
}
