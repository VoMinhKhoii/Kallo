'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

/**
 * Switch the page to a language the person picked, storing it on the
 * account first. The account holds one language: push text is written in it
 * and the phone app follows it, so the web never shows a picked language the
 * account does not hold. A failed save leaves the page as it is and says so.
 */
export function useAccountLocaleSwitch() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();

  return async (next: Locale) => {
    if (next === locale) return;
    try {
      await saveOnboardingScreen(
        1,
        { preferredLocale: next },
        { advance: false }
      );
    } catch {
      toast.error(t('profilePanel.saveError'));
      return;
    }
    switchLocale(next);
  };
}
