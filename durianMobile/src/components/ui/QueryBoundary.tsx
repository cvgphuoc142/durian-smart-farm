import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ApiRequestError, errorMessageKey, normalizeError } from '@/api/errors';
import { spacing } from '@/theme';

import { ErrorState } from './ErrorState';
import { Screen } from './Screen';
import { Skeleton } from './Skeleton';

function LoadingScreen() {
  return (
    <Screen scroll={false} contentStyle={styles.loading}>
      <View accessibilityLabel="loading" style={styles.stack}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={120} radius={20} />
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
      </View>
    </Screen>
  );
}

function ErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const known = error instanceof ApiRequestError ? error : normalizeError(error);
  // A network or server failure says so; anything else gets the generic text.
  const message =
    known.kind === 'unknown'
      ? t('common.loadError')
      : t(errorMessageKey(known, (key) => i18n.exists(key)));
  return (
    <Screen scroll={false}>
      <ErrorState message={message} onRetry={onRetry} />
    </Screen>
  );
}

interface BoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

class ErrorBoundary extends Component<BoundaryProps, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }

  retry = () => {
    this.props.onReset();
    this.setState({ error: null, failed: false });
  };

  render() {
    return this.state.failed ? (
      <ErrorScreen error={this.state.error} onRetry={this.retry} />
    ) : (
      this.props.children
    );
  }
}

/**
 * Wraps a screen that reads suspense queries: skeleton while loading, an error state with
 * "retry" when a query fails. Screens then receive `data` that is never undefined.
 */
export function QueryBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset}>
          <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
  stack: { gap: spacing.md },
});
