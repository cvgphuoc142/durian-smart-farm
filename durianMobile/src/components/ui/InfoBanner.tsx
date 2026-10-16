import { StyleSheet, View } from 'react-native';

import { tones } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InfoBannerProps {
  text: string;
  tone?: 'info' | 'warning' | 'danger';
  icon?: IconName;
}

const textColor = { info: 'infoText', warning: 'warningText', danger: 'dangerText' } as const;

export function InfoBanner({ text, tone = 'info', icon = 'info' }: InfoBannerProps) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Icon name={icon} size={20} color={t.fg} />
      <Text variant="secondary" color={textColor[tone]} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, alignItems: 'flex-start' },
  text: { flex: 1 },
});
