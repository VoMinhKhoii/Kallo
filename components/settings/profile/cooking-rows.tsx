'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { SettingsRow } from '@/components/settings/chrome/group';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

type CookingField = Extract<
  keyof ProfileFormValues,
  | 'oilUsage'
  | 'defaultRicePortion'
  | 'sugarBraised'
  | 'defaultProteinPortion'
  | 'brothConsumption'
>;

interface CookingOption {
  value: string;
  labelKey: string;
  hintKey?: string;
}

interface CookingRowConfig {
  name: CookingField;
  labelKey: string;
  options: CookingOption[];
}

const ROWS: CookingRowConfig[] = [
  {
    name: 'oilUsage',
    labelKey: 'oilUsage',
    options: [
      { value: 'minimal', labelKey: 'oilMinimal', hintKey: 'oilMinimalHint' },
      { value: 'normal', labelKey: 'oilNormal', hintKey: 'oilNormalHint' },
      { value: 'heavy', labelKey: 'oilHeavy', hintKey: 'oilHeavyHint' },
    ],
  },
  {
    name: 'defaultRicePortion',
    labelKey: 'ricePortion',
    options: [
      { value: 'small', labelKey: 'riceSmall', hintKey: 'riceSmallHint' },
      { value: 'medium', labelKey: 'riceMedium', hintKey: 'riceMediumHint' },
      { value: 'large', labelKey: 'riceLarge', hintKey: 'riceLargeHint' },
    ],
  },
  {
    name: 'sugarBraised',
    labelKey: 'sugar',
    options: [
      { value: 'low', labelKey: 'sugarLow' },
      { value: 'medium', labelKey: 'sugarMedium' },
      { value: 'high', labelKey: 'sugarHigh' },
    ],
  },
  {
    name: 'defaultProteinPortion',
    labelKey: 'proteinPortion',
    options: [
      { value: 'small', labelKey: 'proteinSmall', hintKey: 'proteinSmallHint' },
      {
        value: 'medium',
        labelKey: 'proteinMedium',
        hintKey: 'proteinMediumHint',
      },
      { value: 'large', labelKey: 'proteinLarge', hintKey: 'proteinLargeHint' },
    ],
  },
  {
    name: 'brothConsumption',
    labelKey: 'broth',
    options: [
      { value: 'leave_it', labelKey: 'brothLeave', hintKey: 'brothLeaveHint' },
      { value: 'some', labelKey: 'brothSome', hintKey: 'brothSomeHint' },
      {
        value: 'finish_it',
        labelKey: 'brothFinish',
        hintKey: 'brothFinishHint',
      },
    ],
  },
];

export function CookingRows() {
  const t = useTranslations('onboarding.cooking');
  const form = useFormContext<ProfileFormValues>();

  return (
    <>
      {ROWS.map((row) => (
        <FormField
          key={row.name}
          control={form.control}
          name={row.name}
          render={({ field }) => (
            <FormItem>
              <SettingsRow label={t(row.labelKey)}>
                <FormControl>
                  <div className="w-full sm:w-96">
                    <OptionStrip
                      options={row.options.map((o) => ({
                        value: o.value,
                        label: t(o.labelKey),
                        hint: o.hintKey ? t(o.hintKey) : undefined,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </div>
                </FormControl>
              </SettingsRow>
            </FormItem>
          )}
        />
      ))}
    </>
  );
}
