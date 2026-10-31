'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { SettingsRow } from '@/components/settings/chrome/group';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';
import { CountrySelect } from './country-select';

/** Country of origin and residence — profile-form fields on Preferences. */
export function RegionalRows() {
  const tOrigin = useTranslations('onboarding.origin');
  const form = useFormContext<ProfileFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="countryOfOrigin"
        render={({ field }) => (
          <FormItem>
            <SettingsRow label={tOrigin('countryOfOrigin')}>
              <FormControl>
                <div className="w-full sm:w-64">
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
                <div className="w-full sm:w-64">
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
    </>
  );
}
