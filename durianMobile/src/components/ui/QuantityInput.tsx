import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from './Chip';
import { TextInput } from './TextInput';

export interface QuantityInputProps {
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  /** When given, shows a chip per unit so the user can switch (kg / bao / lít). */
  units?: readonly string[];
  onUnitChange?: (unit: string) => void;
  error?: boolean;
  placeholder?: string;
}

export function QuantityInput({
  value,
  onChangeText,
  unit,
  units,
  onUnitChange,
  error,
  placeholder,
}: QuantityInputProps) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? '0'}
        suffix={units ? undefined : unit}
        error={error}
      />
      {units ? (
        <View style={styles.units}>
          {units.map((u) => (
            <Chip key={u} label={u} selected={u === unit} onPress={() => onUnitChange?.(u)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  units: { flexDirection: 'row', gap: spacing.sm },
});
