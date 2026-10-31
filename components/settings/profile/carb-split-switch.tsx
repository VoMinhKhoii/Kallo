'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { CARB_SPLIT_RATIOS } from '@/lib/domain/onboarding/constants';
import type { CarbSplit } from '@/lib/domain/onboarding/types';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

/**
 * The carb split, at the top of the target card: each option carries its
 * protein/carbs/fat percentages, in the order of the macro rows under it.
 */
export function CarbSplitSwitch() {
  const t = useTranslations('onboarding.bodyMetrics');
  const tSettings = useTranslations('settings.carbSplit');
  const form = useFormContext<ProfileFormValues>();

  return (
    <FormField
      control={form.control}
      name="carbSplit"
      render={({ field }) => (
        <FormItem className="gap-1.5">
          <p className="text-[13px] text-kallo-text-muted">{t('carbSplit')}</p>
          <FormControl>
            <div>
              <OptionStrip
                value={field.value ?? ''}
                onChange={field.onChange}
                options={CARB_SPLITS.map((cs) => {
                  const r = CARB_SPLIT_RATIOS[cs];
                  return {
                    value: cs,
                    label: tSettings(cs),
                    hint: `${r.protein}/${r.carbs}/${r.fat}`,
                  };
                })}
              />
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
