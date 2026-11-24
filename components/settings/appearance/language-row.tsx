'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { useAccountLocaleSwitch } from '@/hooks/profile/use-account-locale-switch';
import type { Locale } from '@/i18n/config';

/**
 * Language — the only post-onboarding way to change app language on the web.
 * Switches the locale in place, outside the profile form's dirty state, and
 * stores it on the account: the account holds one language, which pushes are
 * written in and the phone app follows.
 */
export function LanguageRow() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useAccountLocaleSwitch();

  return (
    <SettingsRow label={t('language')}>
      <div className="w-full sm:w-64">
        <CustomSelect
          options={[
            { value: 'en', label: 'English' },
            { value: 'vi', label: 'Tiếng Việt' },
          ]}
          value={locale}
          onChange={(next) => switchLocale(next as Locale)}
        />
      </div>
    </SettingsRow>
  );
}
