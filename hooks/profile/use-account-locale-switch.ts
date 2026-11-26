'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef } from 'react';
import { toast } from 'sonner';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

/**
 * Switch the page to a language the person picked, storing it on the
 * account first. The account holds one language: push text is written in it
 * and the phone app follows it, so the web never shows a picked language the
 * account does not hold.
 *
 * `show` runs once the account holds the language, just before the page
 * switches: the place for anything that reflects the pick on screen. A failed
 * save leaves everything as it was and says so; a pick made while another is
 * saving is ignored, so two saves never race.
 */
export function useAccountLocaleSwitch() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const saving = useRef(false);

  return async (next: Locale, show?: () => void) => {
    if (next === locale || saving.current) return;
    saving.current = true;
    try {
      await saveOnboardingScreen(
        1,
        { preferredLocale: next },
        { advance: false }
      );
    } catch {
      toast.error(t('profilePanel.saveError'));
      return;
    } finally {
      saving.current = false;
    }
    show?.();
    switchLocale(next);
  };
}
