'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { SettingsRow } from '@/components/settings/chrome/group';
import { DecimalInput } from '@/components/shared/decimal-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const inputClass =
  'w-full rounded-lg border border-kallo-border bg-white px-3 py-2 text-[14px] text-kallo-text transition-colors hover:border-kallo-accent/50 focus:border-kallo-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40';

const fieldLabelClass =
  'mb-1.5 block font-medium text-[13px] text-kallo-text-muted';

type NumberFieldName = Extract<
  keyof ProfileFormValues,
  'weightKg' | 'heightCm' | 'age'
>;

function NumberField({
  name,
  label,
  placeholder,
  integer,
}: {
  name: NumberFieldName;
  label: string;
  placeholder: string;
  integer?: boolean;
}) {
  const form = useFormContext<ProfileFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <span className={fieldLabelClass}>{label}</span>
          <FormControl>
            <DecimalInput
              integer={integer}
              inputMode={integer ? 'numeric' : 'decimal'}
              placeholder={placeholder}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              className={inputClass}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function MetricsFields() {
  const t = useTranslations('onboarding.bodyMetrics');
  const tSettings = useTranslations('settings');
  const form = useFormContext<ProfileFormValues>();

  const activityOptions = [
    { value: 'sedentary', label: t('sedentary') },
    { value: 'light', label: t('light') },
    { value: 'moderate', label: t('moderate') },
    { value: 'very_active', label: t('veryActive') },
  ];

  return (
    <SettingsRow label={tSettings('bodyMetrics')} layout="stacked">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Sex */}
        <div className="col-span-2 sm:col-span-1">
          <FormField
            control={form.control}
            name="biologicalSex"
            render={({ field }) => (
              <FormItem>
                <span className={fieldLabelClass}>{t('biologicalSex')}</span>
                <FormControl>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={[
                      { label: t('male'), value: 'male' },
                      { label: t('female'), value: 'female' },
                    ]}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <NumberField
          name="weightKg"
          label={`${t('weight')} (${t('weightUnit')})`}
          placeholder="65"
        />
        <NumberField
          name="heightCm"
          label={`${t('height')} (${t('heightUnit')})`}
          placeholder="170"
          integer
        />
        <NumberField name="age" label={t('age')} placeholder="25" integer />

        {/* Activity Level */}
        <div className="col-span-2 sm:col-span-4">
          <FormField
            control={form.control}
            name="activityLevel"
            render={({ field }) => (
              <FormItem>
                <span className={fieldLabelClass}>{t('activityLevel')}</span>
                <FormControl>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={activityOptions}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </SettingsRow>
  );
}
