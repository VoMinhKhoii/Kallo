'use client';

import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { isPlainClick } from '../plain-click';

/**
 * The way in for anyone not on an iPhone: plain text beside Apple's badge.
 *
 * A real link, so a tap before the page's scripts have arrived still lands on
 * sign-up (`?auth=sign-up` opens the dialog). Once hydrated it opens in place.
 */
export function WebSignUpLink() {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const { openDialog } = useAuthDialog();

  return (
    <a
      href={`/${locale}?auth=sign-up`}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        openDialog('sign-up');
      }}
      className="group inline-flex h-14 items-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium font-sans-display text-base text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-text/40"
    >
      <span className="underline-offset-4 group-hover:underline">
        {t('useWeb')}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-4 transition-transform group-hover:translate-x-1"
      />
    </a>
  );
}
