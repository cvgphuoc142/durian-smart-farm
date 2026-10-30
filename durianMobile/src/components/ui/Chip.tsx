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
  /** Small second line under the label, e.g. "Mô hình đang hoàn thiện". */
  caption?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'primary',
  icon,
  count,
  large = false,
  caption,
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
        caption
          ? { minHeight: sizes.touchTarget, paddingVertical: 6 }
          : { height: large ? sizes.touchTarget : sizes.chip },
        selected ? { backgroundColor: fill, borderColor: fill } : styles.off,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      {caption ? (
        <View>
          <Text variant="label" color={fg}>
            {label}
          </Text>
          <Text variant="caption" color={selected ? colors.primaryOnDark : 'textMuted'}>
            {caption}
          </Text>
        </View>
      ) : (
        <Text variant="label" color={fg}>
          {label}
        </Text>
      )}
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
      {/* Fades the right edge so a cut-off chip reads as "scroll for more". */}
      <View pointerEvents="none" style={styles.fade}>
        {FADE.map((opacity, i) => (
          <View key={i} style={[styles.fadeStep, { opacity }]} />
        ))}
      </View>
    </View>
  );
}

const FADE = [0.15, 0.35, 0.6, 0.85];

const styles = StyleSheet.create({
  row: {
    paddingLeft: spacing.gutter,
    paddingRight: spacing.gutter + spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 24, flexDirection: 'row' },
  fadeStep: { flex: 1, backgroundColor: colors.bg },
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
