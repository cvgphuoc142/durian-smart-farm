import { Image, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export interface PhotoAddProps {
  label: string;
  uris?: string[];
  onPress?: () => void;
}

/** Dashed "add photo" tile followed by picked thumbnails. */
export function PhotoAdd({ label, uris = [], onPress }: PhotoAddProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.add}
      >
        <Icon name="camera" size={24} color="primary" />
        <Text variant="caption" color="primary" style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
      {uris.map((uri) => (
        <Image key={uri} source={{ uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  add: {
    width: 96,
    height: 96,
    gap: 4,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashedStrong,
    backgroundColor: colors.surfaceMuted,
  },
  label: { textAlign: 'center' },
  thumb: { width: 96, height: 96, borderRadius: radius.card },
});
