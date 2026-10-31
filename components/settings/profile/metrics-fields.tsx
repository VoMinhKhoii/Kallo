'use client';

import { useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import { CustomSelect } from '@/components/settings/chrome/custom-select';
import { FieldRow } from '@/components/settings/chrome/field-row';
import { FieldSection } from '@/components/settings/chrome/field-section';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { DecimalInput } from '@/components/shared/decimal-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const inputClass =
  'w-full rounded-lg border border-kallo-border bg-card py-2 pr-10 pl-3 text-[14px] text-kallo-text tabular-nums transition-colors hover:border-kallo-accent/50 focus:border-kallo-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40';

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
          <FieldRow label={label}>
            <div className="flex flex-col items-end gap-1">
              <div className="relative w-32">
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
          </FieldRow>
        </FormItem>
      )}
    />
  );
}

export function MetricsFields() {
  const t = useTranslations('onboarding.bodyMetrics');
  const tSettings = useTranslations('settings');
  const form = useFormContext<ProfileFormValues>();
  const activityLevel = useWatch({
    control: form.control,
    name: 'activityLevel',
  });

  const activity = {
    sedentary: {
      label: tSettings('activity.sedentary.label'),
      hint: tSettings('activity.sedentary.hint'),
    },
    light: {
      label: tSettings('activity.light.label'),
      hint: tSettings('activity.light.hint'),
    },
    moderate: {
      label: tSettings('activity.moderate.label'),
      hint: tSettings('activity.moderate.hint'),
    },
    very_active: {
      label: tSettings('activity.very_active.label'),
      hint: tSettings('activity.very_active.hint'),
    },
  };
  const activityOptions = Object.entries(activity).map(([value, a]) => ({
    value,
    label: a.label,
  }));

  return (
    <FieldSection title={tSettings('bodyMetrics')}>
      <FormField
        control={form.control}
        name="biologicalSex"
        render={({ field }) => (
          <FormItem>
            <FieldRow label={t('biologicalSex')}>
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
            </FieldRow>
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
            <FieldRow
              label={t('activityLevel')}
              description={
                activity[activityLevel as keyof typeof activity]?.hint
              }
            >
              <FormControl>
                <div className={wideControl}>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={activityOptions}
                  />
                </div>
              </FormControl>
            </FieldRow>
          </FormItem>
        )}
      />
    </FieldSection>
  );
}
