'use client';

import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/** The Navigation API, where the browser has it (not yet in lib.dom). */
type WindowWithNavigation = Window & { navigation?: { canGoBack: boolean } };

/**
 * The header's back chevron on a full-screen phone page (the logging feed,
 * which hides the tab bar like Flutter's pushed Log screen). It steps back
 * when there is an in-app page to return to, and otherwise — a deep link, a
 * fresh tab — lands on Today, the way Flutter's `popOr` falls back.
 */
export function MobileBackButton() {
  const t = useTranslations('common');
  const router = useRouter();

  const goBack = () => {
    const { navigation } = window as WindowWithNavigation;
    // `canGoBack` only counts same-origin entries; without the API, any
    // history at all is the best signal there is.
    const canGoBack = navigation?.canGoBack ?? window.history.length > 1;
    if (canGoBack) router.back();
    else router.push('/dashboard');
  };

  return (
    <button
      type="button"
      aria-label={t('back')}
      onClick={goBack}
      className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-kallo-text transition-colors hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
    >
      <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
