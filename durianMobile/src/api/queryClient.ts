import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { ApiRequestError } from './errors';

/** Reflects the device connection in React Query: queries pause offline and refetch on reconnect. */
export function syncOnlineManager() {
  return NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Reads come from the server snapshot; only Scan has an offline store (brief §1).
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (count, error) => {
          // A 4xx will not get better by asking again.
          if (error instanceof ApiRequestError && error.status && error.status < 500) return false;
          return count < 2;
        },
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      // Writes are never retried automatically (FR-X05); the user taps again with the same mutation id.
      mutations: { retry: 0 },
    },
  });
}

export const queryClient = createQueryClient();
