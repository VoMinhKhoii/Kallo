'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

/**
 * Language — the only post-onboarding way to change app language on the web.
 * Switches the locale in place, outside the profile form's dirty state, and
 * stores it on the account: the account holds one language, which pushes are
 * written in and the phone app follows.
 */
export function LanguageRow() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();

  return (
    <SettingsRow label={t('language')}>
      <div className="w-full sm:w-64">
        <CustomSelect
          options={[
            { value: 'en', label: 'English' },
            { value: 'vi', label: 'Tiếng Việt' },
          ]}
          value={locale}
          onChange={(next) => {
            if (next === locale) return;
            saveOnboardingScreen(
              1,
              { preferredLocale: next },
              { advance: false }
            ).catch(() => toast.error(t('profilePanel.saveError')));
            switchLocale(next as Locale);
          }}
        />
      </div>
    </SettingsRow>
  );
}
