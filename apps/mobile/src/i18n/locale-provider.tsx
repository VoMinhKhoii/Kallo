import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { IntlProvider } from 'use-intl';
import { useProfile } from '~/lib/onboarding/hooks/use-profile';
import { useSession } from '~/lib/session';
import { type AppLocale, MESSAGES, resolveDeviceLocale } from './index';

/**
 * Active app locale = profile.preferredLocale → device locale → 'en'.
 *
 * Lives UNDER SessionProvider + QueryClientProvider so it can read the profile
 * query (mirrors how the web remounts under the active locale). Changing the
 * locale re-renders only this IntlProvider subtree — the session + React Query
 * cache above it never unmount, so switching language keeps you signed in and
 * doesn't refetch everything.
 *
 * This makes onboarding's language toggle (which persists `preferredLocale`)
 * actually live-switch the app once the profile cache updates.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(!!userId);

  const deviceLocale = useMemo(resolveDeviceLocale, []);
  const timeZone = useMemo(
    () => Localization.getCalendars()[0]?.timeZone ?? undefined,
    []
  );

  // preferredLocale is a nullable text column ('en' | 'vi' | null); narrow it,
  // else fall back to the device locale (which already defaults to 'en').
  const preferred = profile?.preferredLocale;
  const locale: AppLocale =
    preferred === 'en' || preferred === 'vi' ? preferred : deviceLocale;

  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone={timeZone}>
      {children}
    </IntlProvider>
  );
}
