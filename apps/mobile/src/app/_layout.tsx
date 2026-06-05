import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '~/i18n/locale-provider';
import { AnalyticsProvider } from '~/lib/analytics';
import { warmupApi } from '~/lib/api-client';
import { queryClient } from '~/lib/query-client';
import { SessionProvider } from '~/lib/session';
import { useAppFonts } from '~/theme/fonts';

// --- Sentry (env-gated: a complete no-op until EXPO_PUBLIC_SENTRY_DSN is set) -
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// expo-router navigation instrumentation. Only constructed when Sentry is
// enabled — building it with enableTimeToInitialDisplay would otherwise poke
// native frame-tracking at import time, breaking the no-op-without-a-DSN rule.
const navigationIntegration = SENTRY_DSN
  ? Sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true })
  : null;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment:
      process.env.EXPO_PUBLIC_ENV ?? (__DEV__ ? 'development' : 'production'),
    // Don't ship events while developing; flip with EXPO_PUBLIC_SENTRY_DEBUG=1.
    enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1',
    debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1',
    enableNative: true,
    tracesSampleRate: 1.0,
    integrations: navigationIntegration ? [navigationIntegration] : [],
    // PRIVACY: Nhẩm logs personal meal / body-metric data — never send default PII.
    sendDefaultPii: false,
  });
}

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  // Register expo-router's navigation container for Sentry nav instrumentation
  // (gated — no-op when Sentry isn't initialized).
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationIntegration) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  // Wake the scale-to-zero Cloud Run API on launch so the first real request
  // doesn't pay the cold-start latency. Fire-and-forget.
  useEffect(() => {
    void warmupApi();
  }, []);

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
      <AnalyticsProvider>
        <SafeAreaProvider>
          <SessionProvider>
            <QueryClientProvider client={queryClient}>
              <LocaleProvider>
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="dark" />
              </LocaleProvider>
            </QueryClientProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </AnalyticsProvider>
    </GestureHandlerRootView>
  );
}

// Wrap only when Sentry is enabled, so a key-less build carries zero Sentry HOC.
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
