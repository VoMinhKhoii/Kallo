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
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-4 sm:p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('oilUsage')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'minimal',
                    label: t('oilMinimal'),
                    hint: t('oilMinimalHint'),
                  },
                  {
                    value: 'normal',
                    label: t('oilNormal'),
                    hint: t('oilNormalHint'),
                  },
                  {
                    value: 'heavy',
                    label: t('oilHeavy'),
                    hint: t('oilHeavyHint'),
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
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-4 sm:p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('ricePortion')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'small',
                    label: t('riceSmall'),
                    hint: t('riceSmallHint'),
                  },
                  {
                    value: 'medium',
                    label: t('riceMedium'),
                    hint: t('riceMediumHint'),
                  },
                  {
                    value: 'large',
                    label: t('riceLarge'),
                    hint: t('riceLargeHint'),
                  },
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
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-4 sm:p-5">
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
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-4 sm:p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('proteinPortion')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'small',
                    label: t('proteinSmall'),
                    hint: t('proteinSmallHint'),
                  },
                  {
                    value: 'medium',
                    label: t('proteinMedium'),
                    hint: t('proteinMediumHint'),
                  },
                  {
                    value: 'large',
                    label: t('proteinLarge'),
                    hint: t('proteinLargeHint'),
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
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-4 sm:p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              {t('broth')}
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'leave_it',
                    label: t('brothLeave'),
                    hint: t('brothLeaveHint'),
                  },
                  {
                    value: 'some',
                    label: t('brothSome'),
                    hint: t('brothSomeHint'),
                  },
                  {
                    value: 'finish_it',
                    label: t('brothFinish'),
                    hint: t('brothFinishHint'),
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
