import { useEffect, useState } from 'react';
import { isInAppBrowser } from '@/lib/platform/in-app-browser';

/**
 * Client-only in-app-browser detection. Starts `false` so the first client
 * render matches the server render (where `navigator` is absent), then resolves
 * the real value after hydration. This matters because the auth dialog can be
 * server-rendered *open* via `?auth=`/`?next=` on an invite link, so reading the
 * UA during render would otherwise cause a hydration mismatch.
 *
 * Components rendered only *after* this resolves true (e.g. the webview notice,
 * which is never server-rendered) can read the UA synchronously instead — no
 * hydration risk there, and no post-effect flash.
 */
export function useIsInAppBrowser(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);
  return inApp;
}
