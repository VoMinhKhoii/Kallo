'use client';

import * as Sentry from '@sentry/nextjs';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/infra/supabase/client';
import { analyticsEnabled } from '@/lib/infra/telemetry/analytics/init';
import {
  identifyUser,
  resetUser,
  trackPageview,
} from '@/lib/infra/telemetry/analytics/track';
import { sentryDsn } from '@/lib/infra/telemetry/monitoring/sentry-options';

/**
 * Keeps PostHog and Sentry pointed at whoever is signed in, from one auth
 * listener instead of a call at each of the three sign-out buttons, and sends
 * pageviews only once that identity is settled.
 *
 * The ordering is the point: PostHog restores its persisted identity at init,
 * which may belong to an account whose session has since expired or been
 * revoked elsewhere. Until the first auth callback has identified or reset,
 * nothing is captured — then one `$pageview`, and one per route change.
 *
 * Only the opaque Supabase user id is shared — never email or name. Renders
 * nothing. Both SDKs no-op when their key is unset.
 */
export function TelemetryIdentity() {
  const pathname = usePathname();
  const [identitySettled, setIdentitySettled] = useState(false);

  useEffect(() => {
    // Neither SDK configured → don't even open an auth listener.
    if (!analyticsEnabled() && !sentryDsn()) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id;
      if (userId) {
        identifyUser(userId);
        Sentry.setUser({ id: userId });
      } else {
        resetUser();
        Sentry.setUser(null);
      }
      setIdentitySettled(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is the trigger — one pageview per route change.
  useEffect(() => {
    if (identitySettled) trackPageview();
  }, [identitySettled, pathname]);

  return null;
}
