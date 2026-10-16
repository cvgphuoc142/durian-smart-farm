import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Large page title with an optional right action, or a back-button bar. */
  variant?: 'large' | 'back';
  onBack?: () => void;
  /** Right-side action(s): IconButtons, a Badge, … */
  right?: ReactNode;
  /** Badge or meta shown under the title in the back variant. */
  meta?: ReactNode;
}

export function Header({ title, subtitle, variant = 'large', onBack, right, meta }: HeaderProps) {
  const { t } = useTranslation();

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
          {subtitle ? (
            <Text variant="secondary" color="textMuted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
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
        {subtitle ? (
          <Text variant="secondary" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
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
});
