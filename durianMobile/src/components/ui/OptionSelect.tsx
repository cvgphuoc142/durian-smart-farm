import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { Icon, type IconName } from './Icon';
import { Select } from './Select';
import { Text } from './Text';

export interface Option<T extends string = string> {
  id: T;
  label: string;
}

export interface OptionSelectProps<T extends string> {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  title: string;
  placeholder?: string;
  icon?: IconName;
  error?: boolean;
}

/** `Select` that opens a bottom sheet with the options. */
export function OptionSelect<T extends string>({
  options,
  value,
  onChange,
  title,
  placeholder,
  icon,
  error,
}: OptionSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <>
      <Select
        value={current?.label}
        placeholder={placeholder}
        icon={icon}
        error={error}
        accessibilityLabel={`${title}: ${current?.label ?? placeholder ?? ''}`}
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View>
          {options.map((o) => {
            const on = o.id === value;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={styles.row}
                onPress={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                <Text
                  variant={on ? 'bodyStrong' : 'body'}
                  color={on ? 'primary' : 'text'}
                  style={{ flex: 1 }}
                >
                  {o.label}
                </Text>
                {on ? <Icon name="check" size={20} color="primary" /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
