import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient, syncOnlineManager } from '@/api';
import { ContentSyncHost, ScanSyncHost } from '@/components/domain';
import { OfflineBannerHost, ToastProvider } from '@/components/ui';
import '@/i18n';
import { RootNavigator } from '@/navigation';
import { useAuthStore } from '@/stores';
import { useAppFonts } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsReady = useAppFonts();
  const authReady = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
    return syncOnlineManager();
  }, []);

  const ready = fontsReady && authReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <OfflineBannerHost>
            <RootNavigator />
          </OfflineBannerHost>
          <ScanSyncHost />
          <ContentSyncHost />
          <StatusBar style="dark" />
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
