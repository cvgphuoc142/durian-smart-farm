import { StyleSheet, View } from 'react-native';

import { tones, type Tone } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  /** Leading status dot. */
  dot?: boolean;
}

export function Badge({ label, tone = 'neutral', icon, dot = false }: BadgeProps) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      {icon ? <Icon name={icon} size={13} color={t.fg} strokeWidth={2.4} /> : null}
      <Text variant="caption" color={t.fg} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: 'BeVietnamPro_600SemiBold' },
});
