import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Text } from './Text';

export interface KeyValueItem {
  label: string;
  value: string;
}

/** Info grid on the lot detail card: small muted label over a bold value. */
export function KeyValueGrid({ items, columns = 2 }: { items: KeyValueItem[]; columns?: number }) {
  const width = `${100 / columns}%` as const;
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.cell, { width }]}>
          <View style={styles.inner}>
            <Text variant="caption" color="textMuted">
              {item.label}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -4 },
  cell: { padding: 4 },
  inner: {
    gap: 2,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
