import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetMockDb } from '@/api';
import { ToastProvider } from '@/components/ui';
import { useAuthStore, useContextStore, useDraftStore } from '@/stores';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export const TEST_USER = { id: 'test-user', provider: 'google' as const, display_name: 'Test' };

/** Puts the stores and the mock backend in a known state: signed in (or not), no farm, no drafts. */
export function resetApp({ signedIn = true }: { signedIn?: boolean } = {}) {
  resetMockDb();
  useDraftStore.setState({ drafts: {} });
  useContextStore.setState({ byUser: {} });
  useAuthStore.setState({
    hydrated: true,
    token: signedIn ? 'test-token' : null,
    user: signedIn ? TEST_USER : null,
  });
}

export function renderWithProviders(ui: ReactElement, client = createTestQueryClient()) {
  return {
    client,
    ...render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={client}>
          <ToastProvider>{ui}</ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    ),
  };
}
