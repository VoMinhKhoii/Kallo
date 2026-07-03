'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const HANDLED_CODES = new Set([
  'oauth_missing_code',
  'oauth_exchange',
  'account_exists',
  'verify_failed',
]);

/**
 * Surfaces auth callback/verify failures redirected to /{locale}/?error=*.
 * Mounted on the landing page (the only destination the callback and the
 * emailed-link verify route use for their error redirects today). After
 * firing once we strip the param from the URL via history.replaceState so a
 * refresh doesn't replay the toast.
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
    let message = t('googleError');
    if (error === 'account_exists') message = t('accountExists');
    else if (error === 'verify_failed') message = t('verifyLinkError');
    toast.error(message);

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
