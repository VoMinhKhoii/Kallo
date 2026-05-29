import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '~/i18n';
import { queryClient } from '~/lib/query-client';
import { SessionProvider } from '~/lib/session';
import { useAppFonts } from '~/theme/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Hold on the splash until the brand fonts are ready (or failed to load).
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <SafeAreaProvider>
          <SessionProvider>
            <QueryClientProvider client={queryClient}>
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="dark" />
            </QueryClientProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
