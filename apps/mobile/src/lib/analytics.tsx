import { usePathname } from 'expo-router';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Manual screen tracking for expo-router.
 *
 * PostHog's built-in screen autocapture requires a react-navigation
 * NavigationContainer, which expo-router does not expose (and SDK 56 forbids
 * importing `@react-navigation/*` in app code). Per PostHog's own docs we
 * disable that (`captureScreens: false`) and emit `posthog.screen()` ourselves
 * from the router pathname. Rendered INSIDE PostHogProvider so the client is in
 * context.
 */
function ScreenTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    posthog.screen(pathname);
  }, [posthog, pathname]);

  return null;
}

/**
 * Env-gated PostHog wrapper. With no `EXPO_PUBLIC_POSTHOG_KEY` the client is
 * never constructed and children render unchanged — a complete no-op (no
 * network, no storage, no autocapture). Set the key (+ optional
 * `EXPO_PUBLIC_POSTHOG_HOST`) to enable analytics.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{ host: POSTHOG_HOST }}
      autocapture={{
        captureTouches: true,
        // REQUIRED on expo-router: avoids the @react-navigation screen tracker.
        captureScreens: false,
      }}
    >
      <ScreenTracker />
      {children}
    </PostHogProvider>
  );
}
