import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/ui';
import type { Article } from '@/types';

/** Category code → text. A code the app has no text for is shown as it is. */
export function useCategoryName() {
  const { t } = useTranslation();
  return (code: string) => t(`content.categories.${code}`, { defaultValue: code });
}

/** One article in a list. */
export function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const category = useCategoryName();
  return (
    <ListRow
      title={article.title}
      subtitle={[article.category ? category(article.category) : null, `v${article.version_no}`]
        .filter(Boolean)
        .join(' · ')}
      leading={{ type: 'tile', icon: 'book', tone: article.disease_code ? 'danger' : 'primary' }}
      chevron
      onPress={onPress}
    />
  );
}
