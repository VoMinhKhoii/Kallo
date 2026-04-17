'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { OptionStrip } from '@/components/settings/option-strip';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import type { ProfileFormValues } from './index';

export function Cooking() {
  const t = useTranslations('onboarding.cooking');
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-6">
      {/* Oil usage */}
      <FormField
        control={form.control}
        name="oilUsage"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('oilUsage')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'minimal',
                    label: t('oilMinimal'),
                    hint: 'Dry, clean taste. Dish looks matte.',
                  },
                  {
                    value: 'normal',
                    label: t('oilNormal'),
                    hint: 'Light coating. Slight sheen on food.',
                  },
                  {
                    value: 'heavy',
                    label: t('oilHeavy'),
                    hint: 'Visibly oily. Sauce pools slightly.',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Rice per meal */}
      <FormField
        control={form.control}
        name="defaultRicePortion"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('ricePortion')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'small',
                    label: t('riceSmall'),
                    hint: '~1 small bowl',
                  },
                  {
                    value: 'medium',
                    label: t('riceMedium'),
                    hint: '~1–1.5 bowls',
                  },
                  { value: 'large', label: t('riceLarge'), hint: '~2+ bowls' },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Sugar in braised */}
      <FormField
        control={form.control}
        name="sugarBraised"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('sugar')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  { value: 'low', label: t('sugarLow') },
                  { value: 'medium', label: t('sugarMedium') },
                  { value: 'high', label: t('sugarHigh') },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Protein portion */}
      <FormField
        control={form.control}
        name="defaultProteinPortion"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('proteinPortion')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'small',
                    label: t('proteinSmall'),
                    hint: 'Smaller than your palm, e.g. ~2-3 eggs',
                  },
                  {
                    value: 'medium',
                    label: t('proteinMedium'),
                    hint: 'About palm-sized',
                  },
                  {
                    value: 'large',
                    label: t('proteinLarge'),
                    hint: 'Bigger than your palm, e.g. a chicken thigh or more',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Broth consumption */}
      <FormField
        control={form.control}
        name="brothConsumption"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('broth')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'leave_it',
                    label: t('brothLeave'),
                    hint: 'Eat the solids, skip most broth',
                  },
                  {
                    value: 'some',
                    label: t('brothSome'),
                    hint: 'Drink about half the bowl',
                  },
                  {
                    value: 'finish_it',
                    label: t('brothFinish'),
                    hint: 'Drink all or most of the broth',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
