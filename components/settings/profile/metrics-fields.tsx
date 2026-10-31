'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { FIELD_CLASS } from '@/components/settings/chrome/controls';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { FieldSection } from '@/components/settings/chrome/field-section';
import { SettingsRow } from '@/components/settings/chrome/group';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { DecimalInput } from '@/components/shared/decimal-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'very_active',
] as const;

const inputClass = `${FIELD_CLASS} pr-10 tabular-nums`;

/** Wide controls sit beside the label on a wide page, under it on a phone. */
const wideControl = 'w-full @lg:w-64';

type NumberFieldName = Extract<
  keyof ProfileFormValues,
  'weightKg' | 'heightCm' | 'age'
>;

function NumberField({
  name,
  label,
  unit,
  placeholder,
  integer,
}: {
  name: NumberFieldName;
  label: string;
  unit?: string;
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
          <SettingsRow label={label}>
            <div className="flex flex-col items-end gap-1">
              <div className="relative w-28">
                <FormControl>
                  <DecimalInput
                    integer={integer}
                    inputMode={integer ? 'numeric' : 'decimal'}
                    aria-label={label}
                    placeholder={placeholder}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    className={inputClass}
                  />
                </FormControl>
                {unit && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-kallo-text-muted"
                  >
                    {unit}
                  </span>
                )}
              </div>
              <FormMessage />
            </div>
          </SettingsRow>
        </FormItem>
      )}
    />
  );
}

export function MetricsFields() {
  const t = useTranslations('onboarding.bodyMetrics');
  const tSettings = useTranslations('settings');
  const form = useFormContext<ProfileFormValues>();

  // The hint rides in each option, not under the row's label.
  const activityOptions = ACTIVITY_LEVELS.map((value) => ({
    value,
    label: tSettings(`activity.${value}.label`),
    description: tSettings(`activity.${value}.hint`),
  }));

  return (
    <FieldSection title={tSettings('bodyMetrics')}>
      <FormField
        control={form.control}
        name="biologicalSex"
        render={({ field }) => (
          <FormItem>
            <SettingsRow label={t('biologicalSex')}>
              <FormControl>
                <div className={wideControl}>
                  <OptionStrip
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={[
                      { label: t('male'), value: 'male' },
                      { label: t('female'), value: 'female' },
                    ]}
                  />
                </div>
              </FormControl>
            </SettingsRow>
          </FormItem>
        )}
      />
      <NumberField
        name="weightKg"
        label={t('weight')}
        unit={t('weightUnit')}
        placeholder="65"
      />
      <NumberField
        name="heightCm"
        label={t('height')}
        unit={t('heightUnit')}
        placeholder="170"
        integer
      />
      <NumberField name="age" label={t('age')} placeholder="25" integer />
      <FormField
        control={form.control}
        name="activityLevel"
        render={({ field }) => (
          <FormItem>
            <SettingsRow label={t('activityLevel')}>
              <FormControl>
                <div className={wideControl}>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={activityOptions}
                  />
                </div>
              </FormControl>
            </SettingsRow>
          </FormItem>
        )}
      />
    </FieldSection>
  );
}
