'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/onboarding/constants';
import type { Goal } from '@/lib/onboarding/types';
import type { Screen1FormData } from './constants';

/** kg/week pace slider with the kcal/day translation footer. */
export function AggressionSlider({
  form,
  reportChange,
  goal,
}: {
  form: UseFormReturn<Screen1FormData>;
  reportChange: () => void;
  goal: Goal;
}) {
  const t = useTranslations('onboarding');
  return (
    <FormField
      control={form.control}
      name="aggression"
      render={({ field }) => {
        const aggressionKg = field.value ?? 0.5;
        return (
          <FormItem>
            <FormControl>
              <div className="rounded-2xl border border-[#EAE7E0] bg-white p-4">
                <div className="mb-3 flex items-end justify-between">
                  <label className="block font-bold text-[13px] text-kallo-text">
                    {t('bodyMetrics.aggression')}
                  </label>
                  <div className="font-medium text-[14px] text-kallo-text">
                    {aggressionKg.toFixed(1)}{' '}
                    <span className="text-[#8B8682]">kg/week</span>
                  </div>
                </div>
                <div className="relative px-1">
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.1"
                    value={aggressionKg}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      field.onChange(v);
                      reportChange();
                    }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#EAE7E0] accent-kallo-ink"
                  />
                  <div className="mt-2.5 flex justify-between text-[#8B8682] text-[11px]">
                    <span
                      className={
                        aggressionKg <= 0.3 ? 'font-bold text-kallo-text' : ''
                      }
                    >
                      {t('bodyMetrics.aggressionLow')}
                    </span>
                    <span
                      className={
                        aggressionKg > 0.3 && aggressionKg <= 0.6
                          ? 'font-bold text-kallo-text'
                          : ''
                      }
                    >
                      Moderate
                    </span>
                    <span
                      className={
                        aggressionKg > 0.6 ? 'font-bold text-kallo-text' : ''
                      }
                    >
                      {t('bodyMetrics.aggressionHigh')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-kallo-track px-3 py-2 text-center text-[12px] text-kallo-stone">
                  Translates to a{' '}
                  <span className="font-medium text-kallo-text">
                    ~{Math.round(aggressionKg * AGGRESSION_KCAL_PER_KG)}{' '}
                    kcal/day
                  </span>{' '}
                  {goal === 'cutting' ? 'deficit' : 'surplus'}.
                </div>
              </div>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
