'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUnseenNotificationCount } from '@/hooks/notifications/use-notification-badge';
import { Link } from '@/i18n/navigation';

/**
 * The mobile header's activity entry point. It occupies the right-hand slot
 * that used to be an aria-hidden spacer, so it must keep that element's exact
 * footprint (`size-11`) and strip-mode behaviour — the centered header slot
 * between the hamburger and this button is centered by symmetry, and it drops
 * out with the hamburger when the timeline picker goes full-width.
 */
export function MobileActivityButton() {
  const t = useTranslations('activity');
  const unseenCount = useUnseenNotificationCount();

  return (
    <Link
      href="/activity"
      aria-label={t('mobileButton')}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-kallo-text transition-colors hover:bg-kallo-hover group-has-[[data-strip-mode=true]]/mobileheader:hidden"
    >
      <Heart className="h-5 w-5" aria-hidden="true" />
      {unseenCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-2.5 size-2 rounded-full bg-kallo-accent ring-2 ring-kallo-surface"
        />
      )}
    </Link>
  );
}
