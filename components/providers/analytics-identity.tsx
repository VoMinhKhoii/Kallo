'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { analyticsEnabled } from '@/lib/infra/analytics/init';
import { identifyUser, resetUser } from '@/lib/infra/analytics/track';
import { sentryDsn } from '@/lib/infra/monitoring/sentry-options';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * Keeps PostHog and Sentry pointed at whoever is signed in, from one auth
 * listener instead of a call at each of the three sign-out buttons.
 *
 * Only the opaque Supabase user id is shared — never email or name. Renders
 * nothing. Both SDKs no-op when their key is unset.
 */
export function AnalyticsIdentity() {
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
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
