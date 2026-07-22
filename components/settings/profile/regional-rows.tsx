'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { LanguageToggle } from '@/components/onboarding/language-toggle';
import { SUBSECTION_ANCHOR } from '@/components/settings/anchors';
import { SettingsRow } from '@/components/settings/group';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { CountrySelect } from './country-select';
import type { ProfileFormValues } from './form-schema';

export function RegionalRows() {
  const tOrigin = useTranslations('onboarding.origin');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const form = useFormContext<ProfileFormValues>();

  return (
    <>
      {/* Language — the only post-onboarding way to change app language.
          Switches the locale in place; it lives outside the profile form's
          dirty state (immediate useLocaleSwitch, not an RHF field). */}
      <SettingsRow
        label={tSettings('language')}
        description={tSettings('languageHint')}
      >
        <LanguageToggle
          value={locale}
          onChange={(next) => switchLocale(next as Locale)}
        />
      </SettingsRow>

      <div
        id={SUBSECTION_ANCHOR.regional}
        className="scroll-mt-20 divide-y divide-nham-border"
      >
        <FormField
          control={form.control}
          name="countryOfOrigin"
          render={({ field }) => (
            <FormItem>
              <SettingsRow label={tOrigin('countryOfOrigin')}>
                <FormControl>
                  <div className="w-full sm:w-72">
                    <CountrySelect
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </div>
                </FormControl>
              </SettingsRow>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="countryOfResidence"
          render={({ field }) => (
            <FormItem>
              <SettingsRow label={tOrigin('countryOfResidence')}>
                <FormControl>
                  <div className="w-full sm:w-72">
                    <CountrySelect
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </div>
                </FormControl>
              </SettingsRow>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
