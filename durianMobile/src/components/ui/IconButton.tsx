import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, sizes, shadows } from '@/theme';

import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  variant?: 'plain' | 'outline' | 'filled' | 'dark';
  size?: number;
  /** Small red dot, e.g. unread notifications. */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size = sizes.iconButton,
  badge = false,
  style,
}: IconButtonProps) {
  const dark = variant === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={size < sizes.touchTarget ? (sizes.touchTarget - size) / 2 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: variant === 'dark' ? radius.pill : radius.input,
        },
        variant === 'outline' && styles.outline,
        variant === 'filled' && styles.filled,
        dark && [styles.dark, shadows.fab],
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={dark ? 26 : 24} color={dark ? 'white' : 'text'} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filled: { backgroundColor: colors.primarySoft },
  dark: { backgroundColor: colors.ink },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
