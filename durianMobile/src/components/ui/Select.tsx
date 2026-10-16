import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface SelectProps {
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  icon?: IconName;
  error?: boolean;
  accessibilityLabel?: string;
}

/** Field-looking button that opens a picker (BottomSheet) owned by the screen. */
export function Select({
  value,
  placeholder,
  onPress,
  icon,
  error = false,
  accessibilityLabel,
}: SelectProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? value ?? placeholder}
      onPress={onPress}
      style={({ pressed }) => [styles.box, error && styles.error, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={20} color="iconMuted" /> : null}
      <Text
        variant="body"
        color={value ? 'text' : 'placeholder'}
        style={styles.value}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      <Icon name="chevronDown" size={20} color="iconMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: sizes.input,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  value: { flex: 1 },
  error: { borderColor: colors.danger },
  pressed: { backgroundColor: colors.surfaceMuted },
});
