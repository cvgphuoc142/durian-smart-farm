import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors, radius } from '@/theme';

/** The photo kept on this phone, or a quiet tile when this phone does not have it. */
export function ScanPhoto({
  uri,
  size = 56,
  accessibilityLabel,
}: {
  uri: string | null;
  size?: number;
  accessibilityLabel?: string;
}) {
  const box = { width: size, height: size, borderRadius: size > 80 ? radius.card : 12 };
  return uri ? (
    <Image
      source={{ uri }}
      style={[styles.image, box]}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={[styles.empty, box]} accessibilityLabel={accessibilityLabel}>
      <Icon name="image" size={Math.round(size / 2.4)} color="iconMuted" />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceMuted },
  empty: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
});
