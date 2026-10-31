'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FieldRow } from '@/components/settings/chrome/field-row';
import { FieldSection } from '@/components/settings/chrome/field-section';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/domain/onboarding/constants';
import type { CarbSplit, Goal } from '@/lib/domain/onboarding/types';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const PACE_MIN_KG = 0.1;
const PACE_MAX_KG = 0.8;
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

interface GoalFieldsProps {
  /** Live TDEE; goal/pace/split UI only renders once metrics produce one. */
  tdee: number | null;
  goal: string;
}

export function GoalFields({ tdee, goal }: GoalFieldsProps) {
  const t = useTranslations('onboarding.bodyMetrics');
  const form = useFormContext<ProfileFormValues>();

  const carbInfo: Record<CarbSplit, { label: string; desc: string }> = useMemo(
    () => ({
      moderate_carb: {
        label: t('moderateCarb'),
        desc: t('moderateCarbDescription'),
      },
      lower_carb: { label: t('lowerCarb'), desc: t('lowerCarbDescription') },
      higher_carb: { label: t('higherCarb'), desc: t('higherCarbDescription') },
    }),
    [t]
  );

  if (tdee === null) return null;

  const goalLabels: Record<Goal, string> = {
    maintaining: t('maintaining'),
    cutting: t('cutting'),
    bulking: t('bulking'),
  };

  return (
    <FieldSection title={t('goal')}>
      <FormField
        control={form.control}
        name="goal"
        render={({ field }) => (
          <FormItem className="pt-1 pb-2.5">
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
                    value: g,
                    label: goalLabels[g],
                  }))}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />

      {goal !== 'maintaining' && (
        <FormField
          control={form.control}
          name="aggression"
          render={({ field }) => {
            const aggressionKg = field.value ?? 0.5;
            const kcalDelta = Math.round(aggressionKg * AGGRESSION_KCAL_PER_KG);
            const pace = `${aggressionKg.toFixed(2)} ${t('weightUnit')}/wk`;
            const filled =
              ((aggressionKg - PACE_MIN_KG) / (PACE_MAX_KG - PACE_MIN_KG)) *
              100;
            const delta = `${goal === 'cutting' ? '−' : '+'}${kcalDelta} ${t('perDay')}`;
            return (
              <FormItem>
                <FieldRow
                  label={`${t('aggressionLabel')} (${
                    goal === 'cutting'
                      ? t('aggressionDeficit')
                      : t('aggressionSurplus')
                  })`}
                  description={delta}
                >
                  <div className="@lg:w-80 w-full">
                    <div className="mb-1.5 text-right text-[13px] text-kallo-text tabular-nums">
                      {pace}
                    </div>
                    <FormControl>
                      <input
                        type="range"
                        min={PACE_MIN_KG}
                        max={PACE_MAX_KG}
                        step={0.05}
                        value={aggressionKg}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-label={t('aggressionLabel')}
                        aria-valuetext={`${pace}, ${delta}`}
                        // Native for its keyboard and screen-reader support,
                        // drawn by hand: Chrome paints the unfilled track
                        // near-black beside a light accent colour.
                        style={{
                          background: `linear-gradient(to right, var(--kallo-accent) ${filled}%, var(--kallo-segment) ${filled}%)`,
                        }}
                        className="h-1 w-full appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-kallo-border [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-kallo-border [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                      />
                    </FormControl>
                  </div>
                </FieldRow>
              </FormItem>
            );
          }}
        />
      )}

      <FormField
        control={form.control}
        name="carbSplit"
        render={({ field }) => (
          <FormItem>
            <FieldRow
              label={t('carbSplit')}
              description={carbInfo[field.value as CarbSplit]?.desc}
            >
              <FormControl>
                <div className="@lg:w-96 w-full">
                  <OptionStrip
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={CARB_SPLITS.map((cs) => ({
                      value: cs,
                      label: carbInfo[cs].label,
                    }))}
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
