'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';

/**
 * Language — the only post-onboarding way to change app language. Switches
 * the locale in place, outside the profile form's dirty state, so it works
 * before a profile exists too.
 */
export function LanguageRow() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();

  return (
    <SettingsRow label={t('language')} description={t('languageHint')}>
      <div className="w-full sm:w-72">
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
