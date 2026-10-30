import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, sizes, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** `lg` = 52 (primary actions), `md` = 44 (inline actions). */
  size?: 'lg' | 'md';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to fill a row (`flex: 1`). */
  grow?: boolean;
  /** Spoken name when it should say more than the visible label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const variants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  outline: { bg: colors.surface, fg: colors.primary, border: colors.dashedStrong },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  grow = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const v = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: size === 'lg' ? sizes.button : sizes.buttonSm,
          backgroundColor: v.bg,
          borderColor: v.border,
        },
        grow && styles.grow,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={v.fg} /> : null}
          <Text variant="label" color={v.fg} style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.input,
    borderWidth: 1.5,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
