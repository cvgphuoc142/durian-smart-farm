import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '@/hooks/useIsOnline';

import { OfflineBanner } from './OfflineBanner';

/**
 * Mounts the offline strip once for the whole app. While it shows it sits under the status bar,
 * and the screens below get a zero top inset so they don't leave a second gap.
 */
export function OfflineBannerHost({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  if (online) return <>{children}</>;
  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top, backgroundColor: 'transparent' }}>
        <OfflineBanner visible />
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.root}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
