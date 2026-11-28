'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { AuthErrorCode } from '@/lib/infra/auth/redirects';

/** The `auth.dialog` message for each code. A code the routes add without a
 * message here fails the type check. */
const MESSAGE_KEY = {
  oauth_missing_code: 'signInError',
  oauth_exchange: 'signInError',
  account_exists: 'accountExists',
  verify_failed: 'verifyLinkError',
} as const satisfies Record<AuthErrorCode, string>;

/**
 * Surfaces auth callback/verify failures redirected to /{locale}/?error=*.
 * Mounted on the landing page (the only destination the callback and the
 * emailed-link verify route use for their error redirects today). After
 * firing once we strip the param from the URL via history.replaceState so a
 * refresh doesn't replay the toast.
 */
export function AuthErrorToast() {
  const t = useTranslations('auth.dialog');
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const error = params.get('error');
    if (!error || !Object.hasOwn(MESSAGE_KEY, error)) return;
    fired.current = true;
    toast.error(t(MESSAGE_KEY[error as AuthErrorCode]));

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
