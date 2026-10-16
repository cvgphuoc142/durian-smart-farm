import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export type CardVariant = 'default' | 'danger' | 'warning' | 'info' | 'hero' | 'dashed';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  /** Inner padding; 0 for cards that hold list rows. */
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const variants: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.list,
  },
  danger: { backgroundColor: colors.dangerSoft, borderColor: '#F2C4BE', borderRadius: radius.card },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: '#EBD59B',
    borderRadius: radius.card,
  },
  info: { backgroundColor: colors.infoSoft, borderColor: '#C3D6EC', borderRadius: radius.card },
  hero: { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: radius.hero },
  dashed: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.dashed,
    borderStyle: 'dashed',
    borderRadius: radius.hero,
  },
};

export function Card({
  children,
  variant = 'default',
  padding = spacing.lg - 2,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const base = [styles.card, variants[variant], { padding }, style];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
});
