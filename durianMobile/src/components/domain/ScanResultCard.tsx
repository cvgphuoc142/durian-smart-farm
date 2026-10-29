import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Card, Icon, Text, type IconName } from '@/components/ui';
import { useDiseases } from '@/hooks';
import { spacing, tones, type Tone } from '@/theme';
import type { Locale, Prediction, ScanResultState } from '@/types';

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
 * The four answers of a scan (FR-B04). "Suspected" is worded as a suspicion and the percentages are
 * the model's own prediction rates, never a probability of disease. Nothing here suggests a product or a shop.
 */
export function ScanResultCard({
  state,
  label,
  predictions,
  errorCode,
}: {
  state: ScanResultState;
  label: string | null;
  predictions: Prediction[];
  errorCode?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { tone, icon, card } = look[state];
  const diseases = useDiseases();
  const locale = (i18n.language === 'en' ? 'en' : 'vi') as Locale;
  const nameOf = (code: string | null) => {
    if (!code) return t('result.notDisease');
    const d = diseases.find((x) => x.code === code);
    return d?.names[locale] ?? d?.names.vi ?? d?.names.en ?? code;
  };
  const shown = state === 'error' ? [] : predictions.slice(0, 3);
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
        {shown.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" color="textMuted">
              {t('result.score')}
            </Text>
            <View
              testID="prediction-list"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
            >
              {shown.map((p, i) => (
                <Badge
                  key={`${p.disease_code ?? 'none'}-${i}`}
                  label={`${nameOf(p.disease_code)} ${Math.round(p.score * 100)}%`}
                  tone={i === 0 ? tone : 'neutral'}
                />
              ))}
            </View>
            <Text variant="caption" color="textMuted">
              {t('result.scoreHint')}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
