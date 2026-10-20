import { useTranslation } from 'react-i18next';

import { Badge, ListRow } from '@/components/ui';
import type { Article } from '@/types';

/** Name of a content language in the UI language: "Tiếng Việt" / "English". */
export function useLanguageName() {
  const { t } = useTranslation();
  return (locale: string) => t(`content.lang.${locale}`, { defaultValue: locale });
}

/** Category code → text. A code the app has no text for is shown as it is. */
export function useCategoryName() {
  const { t } = useTranslation();
  return (code: string) => t(`content.categories.${code}`, { defaultValue: code });
}

/** One article in a list. A text shown in its source language says so (FR-C04). */
export function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const { t } = useTranslation();
  const lang = useLanguageName();
  const category = useCategoryName();
  return (
    <ListRow
      title={article.title}
      subtitle={[article.category ? category(article.category) : null, `v${article.version_no}`]
        .filter(Boolean)
        .join(' · ')}
      leading={{ type: 'tile', icon: 'book', tone: article.disease_code ? 'danger' : 'primary' }}
      trailing={
        article.is_fallback ? (
          <Badge
            label={t('content.fallbackShort', { lang: lang(article.locale) })}
            tone="warning"
          />
        ) : undefined
      }
      chevron
      onPress={onPress}
    />
  );
}
