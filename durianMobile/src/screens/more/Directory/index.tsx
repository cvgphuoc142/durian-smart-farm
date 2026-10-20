import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ContactCard } from '@/components/domain';
import {
  Chip,
  ChipRow,
  EmptyState,
  Header,
  ListGroup,
  Screen,
  Text,
  TextInput,
} from '@/components/ui';
import { useContacts, useContentMeta, useProvinces } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import type { ContactKind } from '@/types';

const TYPING_MS = 250;

/**
 * SC-23: approved stores and experts from the downloaded pack, filtered by kind and province
 * (FR-E01). It reads only the phone, so it opens offline.
 */
export function Directory() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const meta = useContentMeta();
  const provinces = useProvinces();
  const [kind, setKind] = useState<ContactKind | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setText(typed), TYPING_MS);
    return () => clearTimeout(id);
  }, [typed]);

  const list = useContacts({ kind, province, text });
  const filtering = kind != null || province != null || text.trim() !== '';

  return (
    <Screen
      header={<Header title={t('screens.Directory')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ gap: spacing.md }}
    >
      <View testID="screen-Directory" style={{ gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.gutter }}>
          <TextInput
            variant="search"
            value={typed}
            onChangeText={setTyped}
            placeholder={t('directory.searchPlaceholder')}
            accessibilityLabel={t('common.search')}
            autoCorrect={false}
          />
        </View>
        <ChipRow>
          <Chip label={t('common.all')} selected={kind == null} onPress={() => setKind(null)} />
          <Chip
            label={t('directory.store')}
            selected={kind === 'store'}
            onPress={() => setKind('store')}
          />
          <Chip
            label={t('directory.expert')}
            selected={kind === 'expert'}
            onPress={() => setKind('expert')}
          />
        </ChipRow>
        {provinces.length > 0 ? (
          <ChipRow>
            <Chip
              label={t('directory.allProvinces')}
              selected={province == null}
              onPress={() => setProvince(null)}
            />
            {provinces.map((p) => (
              <Chip key={p} label={p} selected={province === p} onPress={() => setProvince(p)} />
            ))}
          </ChipRow>
        ) : null}

        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          {!meta.ready || !list.ready ? null : list.data.length === 0 ? (
            <EmptyState
              icon="users"
              title={t(filtering ? 'directory.noMatchTitle' : 'directory.emptyTitle')}
              body={t(
                filtering
                  ? 'directory.noMatchBody'
                  : meta.data
                    ? 'directory.emptyBody'
                    : 'directory.noPackBody',
              )}
            />
          ) : (
            <>
              <Text variant="secondary" color="textMuted">
                {t('directory.count', { count: list.data.length })}
              </Text>
              <ListGroup>
                {list.data.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onPress={() => nav.navigate('ContactDetail', { contactId: c.id })}
                  />
                ))}
              </ListGroup>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}
