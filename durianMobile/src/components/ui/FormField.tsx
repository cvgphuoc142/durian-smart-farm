import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './Text';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, required = false, hint, error, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}
        {required ? (
          <Text variant="label" color="danger">
            {' '}
            *
          </Text>
        ) : null}
      </Text>
      {children}
      {error ? (
        <Text variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="secondary" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: spacing.lg },
});

export const fieldBorder = { default: colors.border, focus: colors.primary, error: colors.danger };
