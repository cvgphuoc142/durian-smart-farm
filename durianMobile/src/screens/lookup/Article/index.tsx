import { StackActions, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useCategoryName } from '@/components/domain';
import {
  Badge,
  Button,
  EmptyState,
  Header,
  InfoBanner,
  ListGroup,
  ListRow,
  Screen,
  Skeleton,
  Text,
  useToast,
} from '@/components/ui';
import { useArticle, useContentRefresh, useDiseases, useFormat, useIsOnline } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal } from '@/services';
import { spacing } from '@/theme';

/**
 * SC-18: one approved article with its sources and the date of its version. A citation passes
 * the version and translation revision it quoted, and exactly that text opens: if it is not on
 * the phone the screen says so instead of showing a newer text in its place (FR-C05, AC-25).
 */
export function Article() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const toast = useToast();
  const online = useIsOnline();
  const category = useCategoryName();
  const refresh = useContentRefresh();
  const { articleId, versionId } = useRoute<RouteProp<RootStackParamList, 'Article'>>().params;
  const { data, ready } = useArticle(articleId, versionId ? { versionId } : undefined);
  const diseases = useDiseases();

  const header = <Header title={t('screens.Article')} variant="back" onBack={() => nav.goBack()} />;

  if (!ready) {
    return (
      <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
        <Skeleton height={28} width="70%" />
        <Skeleton height={160} radius={16} />
      </Screen>
    );
  }

  const { article, current } = data;
  if (!article) {
    return (
      <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
        <View testID="screen-Article" style={{ gap: spacing.md }}>
          <EmptyState
            icon="file"
            title={t('article.missingTitle')}
            body={t(versionId ? 'article.missingVersionBody' : 'article.missingBody')}
            actionLabel={online ? t('content.refresh') : undefined}
            onAction={() => void refresh.refresh()}
          />
          {versionId ? (
            <Button
              variant="outline"
              label={t('article.openCurrent')}
              onPress={() => nav.dispatch(StackActions.replace('Article', { articleId }))}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  const disease = diseases.find((d) => d.code === article.disease_code);
  const open = async (url: string) => {
    if (!(await openExternal(url))) toast.show(t('content.cannotOpen'), 'error');
  };

  return (
    <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}>
      <View testID="screen-Article" style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            {article.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge
              label={t('article.version', {
                no: article.version_no,
                date: f.day(article.published_at),
              })}
              tone="neutral"
            />
            {article.category ? <Badge label={category(article.category)} tone="primary" /> : null}
            {disease ? (
              <Badge label={disease.names[f.locale] ?? disease.code} tone="danger" icon="bug" />
            ) : null}
          </View>
        </View>

        {!current ? (
          <InfoBanner
            tone="warning"
            icon="clock"
            text={t('article.oldVersion', { no: article.version_no })}
          />
        ) : null}

        <View style={{ gap: spacing.md }}>
          {article.body.split(/\n{2,}/).map((p, i) => (
            <Text key={i} variant="body">
              {p}
            </Text>
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading" accessibilityRole="header">
            {t('article.sources')}
          </Text>
          {article.source_links.length === 0 ? (
            <Text variant="secondary" color="textMuted">
              {t('article.noSources')}
            </Text>
          ) : (
            <ListGroup>
              {article.source_links.map((url) => (
                <ListRow
                  key={url}
                  title={url}
                  leading={{ type: 'tile', icon: 'globe', tone: 'info' }}
                  chevron
                  onPress={() => void open(url)}
                />
              ))}
            </ListGroup>
          )}
        </View>

        {!current && versionId ? (
          <Button
            variant="outline"
            label={t('article.openCurrent')}
            onPress={() => nav.dispatch(StackActions.replace('Article', { articleId }))}
          />
        ) : null}
        <InfoBanner tone="info" text={t('article.disclaimer')} />
      </View>
    </Screen>
  );
}
