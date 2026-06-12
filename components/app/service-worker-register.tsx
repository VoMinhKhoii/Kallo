'use client';

import { useEffect } from 'react';

/**
 * Registers the tier-1 offline service worker — but ONLY when the build opts
 * in via `NEXT_PUBLIC_ENABLE_SW === 'true'`. The flag defaults OFF, so merging
 * the offline tier can never register a SW in production by accident (a buggy
 * SW is the classic way to white-screen a deploy).
 *
 * When the flag is unset/off this renders nothing and, defensively, also
 * unregisters any SW a previous opted-in build may have installed — so turning
 * the flag back off is a clean rollback.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const enabled = process.env.NEXT_PUBLIC_ENABLE_SW === 'true';

    if (!enabled) {
      // Rollback path: tear down any SW from a prior opted-in build.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  }, []);

  return null;
}
