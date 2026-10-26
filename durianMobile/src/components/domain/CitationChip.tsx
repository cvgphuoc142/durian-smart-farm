import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Citation } from '@/types';

/**
 * A source of a chatbot answer. It opens the exact article version that was cited.
 */
export function CitationChip({ citation, onPress }: { citation: Citation; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('chat.openSource', { title: citation.title })}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Icon name="file" size={16} color="primary" />
      <Text variant="label" color="primary" numberOfLines={2} style={styles.text}>
        {`${citation.title} · v${citation.version_no}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.7 },
  text: { flexShrink: 1 },
});
