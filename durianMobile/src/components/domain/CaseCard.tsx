import { useTranslation } from 'react-i18next';

import { Badge, ListRow } from '@/components/ui';
import { useFormat } from '@/hooks';
import type { CaseItem } from '@/sync/timeline';

/** A disease case in the list: opened date, how many scans, and whether it is still only on this phone. */
export function CaseCard({ item, onPress }: { item: CaseItem; onPress: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const closed = item.closed_at != null;
  return (
    <ListRow
      title={t('cases.caseTitle', { date: f.date(item.opened_at) })}
      subtitle={[
        t('cases.scanCount', { count: item.scans.length }),
        item.location_note,
        item.pending ? t('cases.pending') : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      leading={{ type: 'tile', icon: 'bug', tone: closed ? 'neutral' : 'danger' }}
      trailing={
        <Badge
          label={closed ? t('cases.closed') : t('cases.open')}
          tone={closed ? 'neutral' : 'warning'}
        />
      }
      chevron
      onPress={onPress}
    />
  );
}
