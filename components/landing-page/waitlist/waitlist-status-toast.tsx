'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  WAITLIST_STATUSES,
  type WaitlistStatus,
} from '@/lib/api/contracts/waitlist';

const HANDLED = new Set<string>(WAITLIST_STATUSES);

/**
 * Surfaces the outcome of the waitlist confirm link, which redirects to
 * `/{locale}/?waitlist=<status>`.
 *
 * Mirrors `OAuthErrorToast`: fire once, then strip the param via
 * `history.replaceState` (preserving Next's routing state) so a refresh does
 * not replay the toast.
 */
export function WaitlistStatusToast() {
  const t = useTranslations('landing.waitlistStatus');
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const status = params.get('waitlist');
    if (!status || !HANDLED.has(status)) return;
    fired.current = true;

    const message = t(status as WaitlistStatus);
    if (status === 'expired' || status === 'invalid') {
      toast.error(message);
    } else {
      toast.success(message);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('waitlist');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, [params, t]);

  return null;
}
