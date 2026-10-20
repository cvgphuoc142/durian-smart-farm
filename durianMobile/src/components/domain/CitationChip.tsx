import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Citation, Locale } from '@/types';

import { useLanguageName } from './ArticleCard';

/**
 * A source of a chatbot answer. It opens the exact version and translation revision that was
 * cited. When the source is in another language than the answer, the chip names it.
 */
export function CitationChip({
  citation,
  answerLocale,
  onPress,
}: {
  citation: Citation;
  answerLocale: Locale;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLanguageName();
  const other = citation.source_locale !== answerLocale;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('chat.openSource', { title: citation.title })}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Icon name="file" size={16} color="primary" />
      <Text variant="label" color="primary" numberOfLines={2} style={styles.text}>
        {`${citation.title} · v${citation.version_no}${
          other ? ` · ${t('chat.sourceLanguage', { lang: lang(citation.source_locale) })}` : ''
        }`}
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
