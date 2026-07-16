'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { DecimalInput } from '@/components/shared/decimal-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  ACTIVITY_LEVEL_KEYS,
  ACTIVITY_LEVELS,
  type Screen1FormData,
} from './constants';
import { CustomSelect } from './custom-select';

const inputClass =
  'w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[14px] text-nham-text transition-colors hover:border-nham-accent/50 focus-visible:border-nham-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/20';

/** "About You" card: sex, weight, height, age, activity level. */
export function AboutYouFields({
  form,
  reportChange,
}: {
  form: UseFormReturn<Screen1FormData>;
  reportChange: () => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <section className="rounded-[28px] border border-[#EAE7E0] bg-white p-5">
      <div className="mb-4">
        <div>
          <p className="font-bold text-[11px] text-nham-stone uppercase tracking-widest">
            About You
          </p>
          <p className="mt-1 text-[#8B8682] text-[13px] leading-relaxed">
            These stay optional, but once you fill them in, Nhẩm can compute
            more tailored targets locally.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <FormField
            control={form.control}
            name="biologicalSex"
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
                  {t('bodyMetrics.biologicalSex')}
                </label>
                <FormControl>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                    options={[
                      { label: t('bodyMetrics.male'), value: 'male' },
                      { label: t('bodyMetrics.female'), value: 'female' },
                    ]}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="weightKg"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
                {`${t('bodyMetrics.weight')} (${t('bodyMetrics.weightUnit')})`}
              </label>
              <FormControl>
                <DecimalInput
                  inputMode="decimal"
                  placeholder="65"
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={() => {
                    field.onBlur();
                    reportChange();
                  }}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="heightCm"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
                {`${t('bodyMetrics.height')} (${t('bodyMetrics.heightUnit')})`}
              </label>
              <FormControl>
                <DecimalInput
                  integer
                  inputMode="numeric"
                  placeholder="170"
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={() => {
                    field.onBlur();
                    reportChange();
                  }}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
                {t('bodyMetrics.age')}
              </label>
              <FormControl>
                <DecimalInput
                  integer
                  inputMode="numeric"
                  placeholder="25"
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={() => {
                    field.onBlur();
                    reportChange();
                  }}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="col-span-2 sm:col-span-4">
          <FormField
            control={form.control}
            name="activityLevel"
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
                  {t('bodyMetrics.activityLevel')}
                </label>
                <FormControl>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                    options={ACTIVITY_LEVELS.map((level) => ({
                      label: t(ACTIVITY_LEVEL_KEYS[level]),
                      value: level,
                    }))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </section>
  );
}
