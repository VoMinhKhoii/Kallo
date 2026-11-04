'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';

const AuthDialog = dynamic(
  () => import('@/components/auth/auth-dialog').then((m) => m.AuthDialog),
  { ssr: false }
);

/**
 * The sign-in dialog, kept out of the page's first load.
 *
 * The dialog brings the forms and the `motion` library with it, and the public
 * pages that host it (landing, pricing, the food and tool pages) use neither
 * otherwise, so importing it directly put all of that ahead of their first
 * paint on a slow phone. It is fetched once the page's `load` event has fired,
 * so a click is normally instant, or straight away if the dialog is opened
 * first (a click before `load`, or an `?auth=` link).
 */
export function LazyAuthDialog() {
  const { open } = useAuthDialog();
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    const markLoaded = () => setPageLoaded(true);
    if (document.readyState === 'complete') {
      markLoaded();
      return;
    }
    window.addEventListener('load', markLoaded, { once: true });
    return () => window.removeEventListener('load', markLoaded);
  }, []);

  return open || pageLoaded ? <AuthDialog /> : null;
}
