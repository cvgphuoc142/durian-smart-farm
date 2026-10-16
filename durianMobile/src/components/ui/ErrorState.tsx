import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={styles.icon}>
        <Icon name="alert" size={28} color="danger" />
      </View>
      <Text variant="body" style={styles.text}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label={t('common.retry')}
          icon="refresh"
          variant="outline"
          size="md"
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, padding: spacing.xxl },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
});
