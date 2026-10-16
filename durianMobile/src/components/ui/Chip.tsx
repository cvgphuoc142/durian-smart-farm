import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** `primary` = green fill (filters), `ink` = dark fill (tabs). */
  tone?: 'primary' | 'ink';
  icon?: IconName;
  count?: number;
  /** 44 high instead of 40. */
  large?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'primary',
  icon,
  count,
  large = false,
}: ChipProps) {
  const fill = tone === 'ink' ? colors.ink : colors.primary;
  const fg = selected ? colors.white : colors.textSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { height: large ? sizes.touchTarget : sizes.chip },
        selected ? { backgroundColor: fill, borderColor: fill } : styles.off,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" color={fg}>
        {label}
      </Text>
      {count != null ? (
        <Text variant="label" color={selected ? colors.primaryOnDark : 'iconMuted'}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Horizontally scrolling row of chips that bleeds to the screen edges. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.gutter, gap: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  off: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.8 },
});
