import { StyleSheet, View } from 'react-native';

import { radius, tones, type Tone } from '@/theme';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: Tone;
  /** Colour the value with the tone (e.g. over-budget in red). */
  emphasize?: boolean;
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  emphasize = false,
}: StatTileProps) {
  const t = tones[tone];
  return (
    <Card padding={14} style={styles.tile}>
      <View style={styles.head}>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: t.bg }]}>
            <Icon name={icon} size={18} color={t.fg} />
          </View>
        ) : null}
        <Text variant="secondary" color="textMuted" style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text
        variant="number"
        color={emphasize ? t.fg : 'text'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: 6, minHeight: 96, borderRadius: radius.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
