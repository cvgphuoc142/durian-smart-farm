import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/theme';

import { Icon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onToggle?: () => void;
  accessibilityLabel: string;
  /** Red ring for overdue tasks. */
  overdue?: boolean;
}

/** Round check circle with a 44 × 44 hit area. */
export function Checkbox({
  checked,
  onToggle,
  accessibilityLabel,
  overdue = false,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.hit}
    >
      <View
        style={[
          styles.circle,
          checked ? styles.on : { borderColor: overdue ? colors.danger : colors.trackOff },
        ]}
      >
        {checked ? <Icon name="check" size={16} color="white" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
});
