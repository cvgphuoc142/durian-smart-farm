import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Makes the subtitle a button with a ▾, e.g. to switch the season. */
  onSubtitlePress?: () => void;
  subtitleLabel?: string;
  /** Large page title with an optional right action, or a back-button bar. */
  variant?: 'large' | 'back';
  onBack?: () => void;
  /** Right-side action(s): IconButtons, a Badge, … */
  right?: ReactNode;
  /** Badge or meta shown under the title in the back variant. */
  meta?: ReactNode;
}

export function Header({
  title,
  subtitle,
  onSubtitlePress,
  subtitleLabel,
  variant = 'large',
  onBack,
  right,
  meta,
}: HeaderProps) {
  const { t } = useTranslation();
  const sub =
    subtitle && onSubtitlePress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitleLabel ? `${subtitleLabel}: ${subtitle}` : subtitle}
        onPress={onSubtitlePress}
        hitSlop={8}
        style={styles.subtitleButton}
      >
        <Text variant="label" color="primary" numberOfLines={1} style={styles.shrink}>
          {subtitle}
        </Text>
        <Icon name="chevronDown" size={18} color="primary" />
      </Pressable>
    ) : subtitle ? (
      <Text variant="secondary" color="textMuted">
        {subtitle}
      </Text>
    ) : null;

  if (variant === 'back') {
    return (
      <View style={[styles.row, styles.backRow]}>
        <IconButton
          icon="back"
          variant="outline"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
        />
        <View style={styles.flex}>
          <Text variant="cardTitle" numberOfLines={1}>
            {title}
          </Text>
          {sub}
        </View>
        {meta}
        {right}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="pageTitle" accessibilityRole="header">
          {title}
        </Text>
        {sub}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backRow: { backgroundColor: colors.bg },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  subtitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 32,
  },
});
