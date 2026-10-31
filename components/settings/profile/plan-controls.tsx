'use client';

import { ArrowDown, ArrowUp, Equal, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { PlanRow } from '@/components/settings/chrome/plan-row';
import { StepSlider } from '@/components/settings/chrome/step-slider';
import { FormControl, FormField } from '@/components/ui/form';
import { useLiveTargets } from '@/hooks/profile/use-live-targets';
import { CARB_SPLIT_RATIOS } from '@/lib/domain/onboarding/constants';
import type { CarbSplit, Goal } from '@/lib/domain/onboarding/types';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const GOALS: { value: Goal; icon: LucideIcon }[] = [
  { value: 'cutting', icon: ArrowDown },
  { value: 'maintaining', icon: Equal },
  { value: 'bulking', icon: ArrowUp },
];
const CARB_SPLITS: CarbSplit[] = ['lower_carb', 'moderate_carb', 'higher_carb'];
const PACE_MIN_KG = 0.1;
const PACE_MAX_KG = 0.8;

/**
 * The three controls that move the daily target — goal, pace (hidden while
 * maintaining) and carb split — as rows inside the target card.
 */
export function PlanControls() {
  const t = useTranslations('onboarding.bodyMetrics');
  const { goal, tdee, targetCalories } = useLiveTargets();
  // The day's actual deficit or surplus (after any calorie floor).
  const kcalPerDay =
    tdee === null ? 0 : Math.abs(Math.round(tdee) - Math.round(targetCalories));
  const tSplit = useTranslations('settings.carbSplit');
  const form = useFormContext<ProfileFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="goal"
        render={({ field }) => (
          <PlanRow label={t('goal')}>
            <FormControl>
              <div>
                <OptionStrip
                  value={field.value ?? ''}
                  onChange={(g) => {
                    field.onChange(g);
                    if (g !== 'maintaining' && !form.getValues('aggression')) {
                      form.setValue('aggression', 0.5, { shouldDirty: true });
                    }
                  }}
                  options={GOALS.map((g) => ({
                    value: g.value,
                    label: t(g.value),
                    icon: g.icon,
                  }))}
                />
              </div>
            </FormControl>
          </PlanRow>
        )}
      />

      {goal !== 'maintaining' && (
        <FormField
          control={form.control}
          name="aggression"
          render={({ field }) => {
            const aggressionKg = field.value ?? 0.5;
            const pace = `${aggressionKg.toFixed(2)} ${t('weightUnit')}/wk`;
            const delta = `${goal === 'cutting' ? '−' : '+'}${kcalPerDay.toLocaleString()} ${t('perDay')} ${
              goal === 'cutting'
                ? t('aggressionDeficit')
                : t('aggressionSurplus')
            }`;
            return (
              <PlanRow label={t('aggressionLabel')}>
                <div className="flex h-9 items-center gap-4">
                  <FormControl>
                    <StepSlider
                      min={PACE_MIN_KG}
                      max={PACE_MAX_KG}
                      step={0.05}
                      tickEvery={0.1}
                      value={aggressionKg}
                      onChange={field.onChange}
                      aria-label={t('aggressionLabel')}
                      aria-valuetext={`${pace}, ${delta}`}
                    />
                  </FormControl>
                  <span className="w-36 shrink-0 text-right tabular-nums">
                    <span className="block text-[14px] text-kallo-text">
                      {pace}
                    </span>
                    <span className="block text-[13px] text-kallo-text-muted">
                      {delta}
                    </span>
                  </span>
                </div>
              </PlanRow>
            );
          }}
        />
      )}

      <FormField
        control={form.control}
        name="carbSplit"
        render={({ field }) => (
          <PlanRow label={t('carbSplit')}>
            <FormControl>
              <div>
                <OptionStrip
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  // Protein/carbs/fat, the order of the macros beside it.
                  options={CARB_SPLITS.map((cs) => {
                    const r = CARB_SPLIT_RATIOS[cs];
                    return {
                      value: cs,
                      label: tSplit(cs),
                      description: `${r.protein}/${r.carbs}/${r.fat}`,
                    };
                  })}
                />
              </div>
            </FormControl>
          </PlanRow>
        )}
      />
    </>
  );
}
