import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Citation } from '@/types';

/**
 * A source of a chatbot answer, kept small so the answer stays the focus. The chip opens the
 * exact article version that was cited; when that version has original documents, a quiet
 * "Original text" link beside it opens them.
 */
export function CitationChip({
  citation,
  onPress,
  onOpenOriginal,
}: {
  citation: Citation;
  onPress: () => void;
  onOpenOriginal?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('chat.openSource', { title: citation.title })}
        hitSlop={6}
        onPress={onPress}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Icon name="file" size={14} color="primary" />
        <Text variant="caption" color="primary" numberOfLines={2} style={styles.text}>
          {`${citation.title} · v${citation.version_no}`}
        </Text>
      </Pressable>
      {onOpenOriginal && citation.source_links.length > 0 ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('chat.originalText')}
          hitSlop={8}
          onPress={onOpenOriginal}
          style={({ pressed }) => [styles.original, pressed && styles.pressed]}
        >
          <Icon name="globe" size={14} color="textMuted" />
          <Text variant="caption" color="textMuted">
            {t('chat.originalText')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  original: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  text: { flexShrink: 1 },
});
