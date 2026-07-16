'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { calcMacroGrams } from '@/lib/onboarding/tdee';
import type { Goal } from '@/lib/onboarding/types';
import { AggressionSlider } from './aggression-slider';
import { CarbSplitPicker } from './carb-split-picker';
import {
  CARB_SPLIT_DESCS,
  CARB_SPLIT_KEYS,
  CARB_SPLITS,
  type CarbOption,
  GOAL_KEYS,
  GOALS,
  type Screen1FormData,
} from './constants';

/**
 * The live targets card: TDEE readout, goal picker, pace slider (when not
 * maintaining), and the carb-split macro planner.
 */
export function GoalTuning({
  form,
  reportChange,
  tdee,
  goal,
  targetCalories,
}: {
  form: UseFormReturn<Screen1FormData>;
  reportChange: () => void;
  tdee: number;
  goal: Goal;
  targetCalories: number;
}) {
  const t = useTranslations('onboarding');

  // Carb split options with computed macros
  const carbOptions = useMemo<CarbOption[]>(
    () =>
      CARB_SPLITS.map((cs) => {
        const macros = calcMacroGrams(targetCalories, cs);
        return {
          id: cs,
          label: t(CARB_SPLIT_KEYS[cs]),
          desc: t(CARB_SPLIT_DESCS[cs]),
          macros,
        };
      }),
    [targetCalories, t]
  );

  return (
    <section className="space-y-4 rounded-[28px] border border-[#EAE7E0] bg-white p-5">
      <div className="flex flex-col gap-4 border-[#EAE7E0]/80 border-b pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="mb-1 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
            {t('bodyMetrics.tdee')}
          </span>
          <div className="font-normal font-serif text-4xl text-nham-text tracking-tighter">
            ~{Math.round(tdee).toLocaleString()}{' '}
            <span className="font-sans text-[#8B8682] text-lg">
              {t('bodyMetrics.kcal')}
            </span>
          </div>
        </div>

        <div className="w-full xl:w-auto">
          <label className="mb-2 block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
            {t('bodyMetrics.goal')}
          </label>
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="grid grid-cols-3 rounded-xl bg-[#EAE7E0]/50 p-1">
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          field.onChange(g);
                          reportChange();
                        }}
                        className={`rounded-lg px-3 py-1.5 font-medium text-[14px] transition-all ${
                          field.value === g
                            ? 'bg-white text-nham-text shadow-sm'
                            : 'text-[#8B8682] hover:text-nham-text'
                        }`}
                      >
                        {t(GOAL_KEYS[g])}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>

      {goal !== 'maintaining' && (
        <AggressionSlider form={form} reportChange={reportChange} goal={goal} />
      )}

      {targetCalories > 0 && (
        <CarbSplitPicker
          form={form}
          reportChange={reportChange}
          targetCalories={targetCalories}
          carbOptions={carbOptions}
        />
      )}
    </section>
  );
}
