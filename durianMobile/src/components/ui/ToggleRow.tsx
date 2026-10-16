import { StyleSheet, Switch, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './Text';

export interface ToggleRowProps {
  title: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ title, hint, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {hint ? (
          <Text variant="secondary" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.trackOff, true: colors.primary }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.trackOff}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: 2 },
});
