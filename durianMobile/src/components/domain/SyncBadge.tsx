import { useTranslation } from 'react-i18next';

import { Badge, Text, type IconName } from '@/components/ui';
import type { Tone } from '@/theme';
import type { ScanSyncState } from '@/types';

const look: Record<ScanSyncState, { tone: Tone; icon: IconName }> = {
  saved_on_device: { tone: 'neutral', icon: 'clock' },
  sending: { tone: 'info', icon: 'refresh' },
  synced: { tone: 'primary', icon: 'check' },
  error: { tone: 'danger', icon: 'alert' },
};

/** The four states of a saved scan (FR-X06). "Synced" means the data and the photo are both acknowledged. */
export function SyncBadge({ state }: { state: ScanSyncState }) {
  const { t } = useTranslation();
  return <Badge label={t(`sync.${state}`)} tone={look[state].tone} icon={look[state].icon} />;
}

/** Same states as plain text, for rows and sheets where a pill is too heavy. */
export function SyncStateText({ state }: { state: ScanSyncState }) {
  const { t } = useTranslation();
  return (
    <Text variant="caption" color={state === 'error' ? 'danger' : 'textMuted'}>
      {t(`sync.${state}`)}
    </Text>
  );
}
