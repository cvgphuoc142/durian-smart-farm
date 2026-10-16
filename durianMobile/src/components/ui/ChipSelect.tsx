import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from './Chip';

export interface ChipOption<T extends string = string> {
  id: T;
  label: string;
}

export type ChipSelectProps<T extends string> =
  | {
      options: readonly ChipOption<T>[];
      multiple?: false;
      value: T | null;
      onChange: (value: T) => void;
    }
  | {
      options: readonly ChipOption<T>[];
      multiple: true;
      value: readonly T[];
      onChange: (value: T[]) => void;
    };

/** Wrapping group of chips: single choice (type chips) or multi choice (varieties). */
export function ChipSelect<T extends string>(props: ChipSelectProps<T>) {
  return (
    <View style={styles.wrap}>
      {props.options.map((o) => {
        const selected = props.multiple ? props.value.includes(o.id) : props.value === o.id;
        return (
          <Chip
            key={o.id}
            label={o.label}
            selected={selected}
            large
            onPress={() => {
              if (props.multiple) {
                props.onChange(
                  selected ? props.value.filter((v) => v !== o.id) : [...props.value, o.id],
                );
              } else {
                props.onChange(o.id);
              }
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
