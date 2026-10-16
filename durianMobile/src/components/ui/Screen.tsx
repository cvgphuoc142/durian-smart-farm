import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Fixed header rendered above the scrolling content. */
  header?: ReactNode;
  /** Sticky footer (e.g. save button, bottom action bar). */
  footer?: ReactNode;
  scroll?: boolean;
  /** Leave room for the bottom tab bar. */
  withTabBar?: boolean;
  /** Apply the top safe-area inset. Turn off for modals that draw their own handle. */
  topInset?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  withTabBar = false,
  topInset = true,
  background = colors.bg,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = withTabBar ? sizes.tabBar + insets.bottom + spacing.lg : spacing.xxl;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background, paddingTop: topInset ? insets.top : 0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[{ paddingBottom: footer ? spacing.lg : bottomPad }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
