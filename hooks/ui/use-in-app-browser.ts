import { useEffect, useState } from 'react';
import { isAndroid, isInAppBrowser } from '@/lib/in-app-browser';

/**
 * Client-only in-app-browser detection. Starts `false` so the first client
 * render matches the server render (where `navigator` is absent), then resolves
 * the real value after hydration. This matters because the auth dialog can be
 * server-rendered *open* via `?auth=`/`?next=` on an invite link, so reading the
 * UA during render would otherwise cause a hydration mismatch.
 */
export function useIsInAppBrowser(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);
  return inApp;
}

/** Client-only Android detection, hydration-safe (see `useIsInAppBrowser`). */
export function useIsAndroid(): boolean {
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    setAndroid(isAndroid());
  }, []);
  return android;
}
