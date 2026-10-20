import { useNetInfo } from '@react-native-community/netinfo';

/** False only when the device reports no connection; `null` states (still probing) count as online. */
export function useIsOnline() {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected !== false && isInternetReachable !== false;
}
