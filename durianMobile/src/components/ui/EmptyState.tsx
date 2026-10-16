import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

/** Dashed card for empty lists ("chưa có …") with an optional action. */
export function EmptyState({
  title,
  body,
  icon = 'sprout',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card variant="dashed" padding={spacing.xl}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Icon name={icon} size={28} color="primary" />
        </View>
        <Text variant="cardTitle" style={styles.text}>
          {title}
        </Text>
        {body ? (
          <Text variant="secondary" color="textMuted" style={styles.text}>
            {body}
          </Text>
        ) : null}
        {actionLabel ? (
          <Button label={actionLabel} onPress={onAction} variant="outline" size="md" />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
});
