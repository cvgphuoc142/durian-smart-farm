import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
  /** Ref to the scroll view, e.g. to scroll a chat to its newest message. */
  scrollRef?: Ref<ScrollView>;
  /** Pull-to-refresh handler; defaults to the app-wide one. Only used when `scroll` is on. */
  onRefresh?: Refresh;
}

type Refresh = () => Promise<unknown>;

const RefreshContext = createContext<Refresh | null>(null);

/** What pull-to-refresh does on every scrolling `Screen` that does not pass its own `onRefresh`. */
export const ScreenRefreshProvider = RefreshContext.Provider;

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  withTabBar = false,
  topInset = true,
  background = colors.bg,
  contentStyle,
  onRefresh,
  scrollRef,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inherited = useContext(RefreshContext);
  const refresh = onRefresh ?? inherited;
  const [refreshing, setRefreshing] = useState(false);
  const pull = useCallback(() => {
    if (!refresh) return;
    setRefreshing(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [refresh]);
  const bottomPad = withTabBar ? sizes.tabBar + insets.bottom + spacing.lg : spacing.xxl;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background, paddingTop: topInset ? insets.top : 0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[{ paddingBottom: footer ? spacing.lg : bottomPad }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            refresh ? <RefreshControl refreshing={refreshing} onRefresh={pull} /> : undefined
          }
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
