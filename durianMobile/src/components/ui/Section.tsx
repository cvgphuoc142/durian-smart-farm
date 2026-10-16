import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './Text';

export interface SectionProps {
  title?: string;
  /** Count shown in a small pill next to the title. */
  count?: number;
  linkLabel?: string;
  onLinkPress?: () => void;
  children?: ReactNode;
  /** Remove the horizontal gutter when the content scrolls edge to edge. */
  flush?: boolean;
}

export function Section({
  title,
  count,
  linkLabel,
  onLinkPress,
  children,
  flush = false,
}: SectionProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.head}>
          <View style={styles.titleRow}>
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            {count != null ? (
              <View style={styles.count}>
                <Text variant="caption" color="primary">
                  {count}
                </Text>
              </View>
            ) : null}
          </View>
          {linkLabel ? (
            <Pressable
              accessibilityRole="link"
              onPress={onLinkPress}
              hitSlop={12}
              style={styles.link}
            >
              <Text variant="label" color="primary">
                {linkLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={flush ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl - 2 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    marginBottom: spacing.md,
    minHeight: 28,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  link: { minHeight: 44, justifyContent: 'center' },
  body: { paddingHorizontal: spacing.gutter },
});
