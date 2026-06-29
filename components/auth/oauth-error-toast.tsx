'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const HANDLED_CODES = new Set([
  'oauth_missing_code',
  'oauth_exchange',
  'account_exists',
]);

/**
 * Surfaces OAuth callback failures redirected to /{locale}/?error=oauth_*.
 * Mounted on the landing page (the only destination the callback uses for
 * its error redirect today). After firing once we strip the param from the
 * URL via history.replaceState so a refresh doesn't replay the toast.
 */
export function OAuthErrorToast() {
  const t = useTranslations('auth.dialog');
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const error = params.get('error');
    if (!error || !HANDLED_CODES.has(error)) return;
    fired.current = true;
    toast.error(error === 'account_exists' ? t('accountExists') : t('googleError'));

    // Strip the param so a refresh doesn't replay the toast. Preserve
    // existing history.state — Next's App Router stores routing metadata
    // there and replacing it with `{}` desyncs back/forward navigation.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, [params, t]);

  return null;
}
