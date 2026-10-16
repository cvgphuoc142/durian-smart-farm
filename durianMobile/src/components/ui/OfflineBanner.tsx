import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/** Slim strip shown under the header while the device is offline. */
export function OfflineBanner({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="wifiOff" size={16} color="warningText" />
      <Text variant="caption" color="warningText" style={styles.text}>
        {t('common.offlineBanner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 8,
    backgroundColor: colors.warningSoft,
  },
  text: { flex: 1 },
});
