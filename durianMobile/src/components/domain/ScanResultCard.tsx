import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Card, Icon, Text, type IconName } from '@/components/ui';
import { spacing, tones, type Tone } from '@/theme';
import type { ScanResultState } from '@/types';

const look: Record<
  ScanResultState,
  { tone: Tone; icon: IconName; card: 'warning' | 'info' | 'danger' | 'default' }
> = {
  suspected: { tone: 'warning', icon: 'alert', card: 'warning' },
  healthy: { tone: 'primary', icon: 'check', card: 'default' },
  inconclusive: { tone: 'neutral', icon: 'info', card: 'default' },
  error: { tone: 'danger', icon: 'alert', card: 'danger' },
};

/**
 * The four answers of a scan (FR-B04). "Suspected" is worded as a suspicion and the score is the
 * model's score, never a probability of disease. Nothing here suggests a product or a shop.
 */
export function ScanResultCard({
  state,
  label,
  score,
  errorCode,
}: {
  state: ScanResultState;
  label: string | null;
  score: number | null;
  errorCode?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { tone, icon, card } = look[state];
  const title =
    state === 'suspected'
      ? label
        ? t('result.suspectedTitle', { label })
        : t('result.suspectedTitleNoLabel')
      : t(`result.${state}Title`);
  const body =
    state === 'error' && errorCode && i18n.exists(`result.errorCodes.${errorCode}`)
      ? `${t('result.errorBody')} ${t(`result.errorCodes.${errorCode}`)}`
      : t(`result.${state}Body`);

  return (
    <Card variant={card} padding={spacing.lg}>
      <View accessibilityRole="summary" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={icon} size={22} color={tones[tone].fg} />
          <Text variant="title" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
        <Text variant="secondary" color="textMuted">
          {body}
        </Text>
        {score != null && (state === 'suspected' || state === 'healthy') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Badge label={`${t('result.score')}: ${Math.round(score * 100)}%`} tone={tone} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
