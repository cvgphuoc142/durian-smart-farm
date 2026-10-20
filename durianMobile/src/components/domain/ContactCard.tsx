import { useTranslation } from 'react-i18next';

import { Badge, ListRow } from '@/components/ui';
import type { Contact } from '@/types';

/** One store or expert in the directory. */
export function ContactCard({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const { t } = useTranslation();
  const expert = contact.kind === 'expert';
  return (
    <ListRow
      title={contact.name}
      subtitle={[contact.locality, contact.province].filter(Boolean).join(', ') || undefined}
      leading={{
        type: 'tile',
        icon: expert ? 'user' : 'package',
        tone: expert ? 'info' : 'primary',
      }}
      trailing={
        <Badge
          label={t(expert ? 'directory.expert' : 'directory.store')}
          tone={expert ? 'info' : 'neutral'}
        />
      }
      chevron
      onPress={onPress}
    />
  );
}
