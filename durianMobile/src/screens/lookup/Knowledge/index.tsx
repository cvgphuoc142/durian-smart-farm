import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ArticleCard, useCategoryName } from '@/components/domain';
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  IconButton,
  InfoBanner,
  ListGroup,
  Screen,
  Text,
  TextInput,
} from '@/components/ui';
import {
  useArticleFacets,
  useArticleList,
  useContentMeta,
  useContentRefresh,
  useFormat,
  useIsOnline,
  usePartLabel,
} from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';

/** Words typed settle for this long before the list is searched again. */
const TYPING_MS = 250;

/**
 * SC-17: the approved articles on the phone, searched with or without diacritics, in Vietnamese
 * and English, filtered by category, body part and stage (FR-C01). Reads only the local pack, so
 * it works offline; a missing or failed download says so (FR-C03).
 */
export function Knowledge() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const online = useIsOnline();
  const category = useCategoryName();
  const part = usePartLabel();
  const meta = useContentMeta();
  const refresh = useContentRefresh();
  const facets = useArticleFacets();

  const [typed, setTyped] = useState('');
  const [text, setText] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [partFilter, setPartFilter] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setText(typed), TYPING_MS);
    return () => clearTimeout(id);
  }, [typed]);

  const list = useArticleList({ text, category: cat, part: partFilter, stage });
  const filtering = text.trim() !== '' || cat != null || partFilter != null || stage != null;
  const havePack = meta.data != null;

  const filterRow = (
    label: string,
    options: string[],
    value: string | null,
    set: (v: string | null) => void,
    name: (v: string) => string,
  ) =>
    options.length > 0 ? (
      <View accessibilityLabel={label} style={{ gap: spacing.xs }}>
        <Text variant="caption" color="textMuted" style={{ paddingHorizontal: spacing.gutter }}>
          {label}
        </Text>
        <ChipRow>
          <Chip label={t('common.all')} selected={value == null} onPress={() => set(null)} />
          {options.map((o) => (
            <Chip key={o} label={name(o)} selected={value === o} onPress={() => set(o)} />
          ))}
        </ChipRow>
      </View>
    ) : null;

  return (
    <Screen
      withTabBar
      header={
        <Header
          title={t('screens.Knowledge')}
          right={
            <IconButton
              icon="refresh"
              variant="outline"
              accessibilityLabel={t('content.refresh')}
              onPress={() => void refresh.refresh()}
            />
          }
        />
      }
      contentStyle={{ gap: spacing.md }}
    >
      <View testID="screen-Knowledge" style={{ gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              grow
              size="md"
              variant="outline"
              icon="chat"
              label={t('screens.Chatbot')}
              onPress={() => nav.navigate('Chatbot')}
            />
            <Button
              grow
              size="md"
              variant="outline"
              icon="shieldCheck"
              label={t('knowledge.standards')}
              onPress={() => nav.navigate('Standards')}
            />
          </View>
          <TextInput
            variant="search"
            value={typed}
            onChangeText={setTyped}
            placeholder={t('knowledge.searchPlaceholder')}
            accessibilityLabel={t('common.search')}
            returnKeyType="search"
            autoCorrect={false}
          />
          {refresh.state === 'failed' ? (
            <InfoBanner
              tone="warning"
              icon="alert"
              text={t(havePack ? 'content.updateFailedKeep' : 'content.updateFailed', {
                release: meta.data?.release_no,
              })}
            />
          ) : null}
          {refresh.state === 'unsupported' ? (
            <InfoBanner tone="warning" icon="alert" text={t('content.needsAppUpdate')} />
          ) : null}
        </View>

        {filterRow(t('knowledge.category'), facets.categories, cat, setCat, category)}
        {filterRow(t('knowledge.part'), facets.parts, partFilter, setPartFilter, part)}
        {filterRow(t('knowledge.stage'), facets.stages, stage, setStage, (s) =>
          t(`stages.${s}`, { defaultValue: s }),
        )}

        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          {!meta.ready ? null : !havePack ? (
            <EmptyState
              icon="download"
              title={t('knowledge.noPackTitle')}
              body={t(online ? 'knowledge.noPackBody' : 'knowledge.noPackOffline')}
              actionLabel={online ? t('content.download') : undefined}
              onAction={() => void refresh.refresh()}
            />
          ) : list.data.length === 0 ? (
            <EmptyState
              icon="search"
              title={t(filtering ? 'knowledge.noMatchTitle' : 'knowledge.emptyTitle')}
              body={t(filtering ? 'knowledge.noMatchBody' : 'knowledge.emptyBody')}
            />
          ) : (
            <>
              <Text variant="secondary" color="textMuted">
                {t('knowledge.count', { count: list.data.length })}
              </Text>
              <ListGroup>
                {list.data.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    onPress={() => nav.navigate('Article', { articleId: a.id })}
                  />
                ))}
              </ListGroup>
            </>
          )}
          {meta.data ? (
            <Text variant="caption" color="textMuted">
              {t('content.release', {
                release: meta.data.release_no,
                date: f.day(meta.data.installed_at),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
