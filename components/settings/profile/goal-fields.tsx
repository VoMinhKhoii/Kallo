'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { SettingsRow } from '@/components/settings/group';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/onboarding/constants';
import { calcMacroGrams } from '@/lib/onboarding/tdee';
import type { CarbSplit, Goal } from '@/lib/onboarding/types';
import type { ProfileFormValues } from './form-schema';

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

interface GoalFieldsProps {
  /** Live TDEE; goal/pace/split UI only renders once metrics produce one. */
  tdee: number | null;
  targetCalories: number;
  goal: string;
}

export function GoalFields({ tdee, targetCalories, goal }: GoalFieldsProps) {
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

  const carbOptions = useMemo(
    () =>
      CARB_SPLITS.map((cs) => ({
        id: cs,
        ...carbInfo[cs],
        macros: calcMacroGrams(targetCalories, cs),
      })),
    [targetCalories, carbInfo]
  );

  if (tdee === null) return null;

  const goalLabels: Record<Goal, string> = {
    maintaining: t('maintaining'),
    cutting: t('cutting'),
    bulking: t('bulking'),
  };

  return (
    <>
      {/* Goal */}
      <FormField
        control={form.control}
        name="goal"
        render={({ field }) => (
          <FormItem>
            <SettingsRow label={t('goal')} layout="stacked">
              <FormControl>
                <div className="flex w-full gap-1 rounded-xl bg-kallo-track p-1">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={field.value === g}
                      onClick={() => {
                        field.onChange(g);
                        if (
                          g !== 'maintaining' &&
                          !form.getValues('aggression')
                        ) {
                          form.setValue('aggression', 0.5, {
                            shouldDirty: true,
                          });
                        }
                      }}
                      className={`flex-1 rounded-lg px-2 py-2 text-center font-medium text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 ${
                        field.value === g
                          ? 'bg-white text-kallo-text shadow-sm'
                          : 'text-kallo-text-muted hover:text-kallo-text'
                      }`}
                    >
                      {goalLabels[g]}
                    </button>
                  ))}
                </div>
              </FormControl>
            </SettingsRow>
          </FormItem>
        )}
      />

      {/* Aggression */}
      {goal !== 'maintaining' && (
        <FormField
          control={form.control}
          name="aggression"
          render={({ field }) => {
            const aggressionKg = field.value ?? 0.5;
            const kcalDelta = Math.round(aggressionKg * AGGRESSION_KCAL_PER_KG);
            const label = `${t('aggressionLabel')} (${
              goal === 'cutting'
                ? t('aggressionDeficit')
                : t('aggressionSurplus')
            })`;
            return (
              <FormItem>
                <SettingsRow label={label} layout="stacked">
                  <div className="space-y-3">
                    <div className="text-center font-medium text-[15px] text-kallo-text">
                      {aggressionKg.toFixed(2)} {t('weightUnit')}/wk
                      <span className="text-kallo-text-muted"> · </span>
                      {goal === 'cutting' ? '−' : '+'}
                      {kcalDelta} {t('perDay')}
                    </div>
                    <FormControl>
                      <input
                        type="range"
                        min={0.1}
                        max={0.8}
                        step={0.05}
                        value={aggressionKg}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-label={t('aggressionLabel')}
                        aria-valuetext={`${aggressionKg.toFixed(2)} ${t('weightUnit')}/wk, ${
                          goal === 'cutting' ? '−' : '+'
                        }${kcalDelta} ${t('perDay')}`}
                        className="w-full accent-kallo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40"
                      />
                    </FormControl>
                    <div className="flex items-center justify-between text-[12px] text-kallo-text-muted">
                      <span>{t('aggressionLow')}</span>
                      <span>{t('aggressionHigh')}</span>
                    </div>
                  </div>
                </SettingsRow>
              </FormItem>
            );
          }}
        />
      )}

      {/* Carb Split */}
      <FormField
        control={form.control}
        name="carbSplit"
        render={({ field }) => (
          <FormItem>
            <SettingsRow label={t('carbSplit')} layout="stacked">
              <FormControl>
                <div className="grid gap-3 sm:grid-cols-3">
                  {carbOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={field.value === opt.id}
                      onClick={() => field.onChange(opt.id)}
                      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 ${
                        field.value === opt.id
                          ? 'border-kallo-text/30 bg-kallo-hover shadow-sm'
                          : 'border-kallo-border bg-white hover:border-kallo-accent/50'
                      }`}
                    >
                      <span className="font-medium text-[14px] text-kallo-text">
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-kallo-text-muted">
                        {opt.desc}
                      </span>
                      <div className="mt-1 flex gap-3 text-[11px]">
                        <span className="text-kallo-text-muted">
                          P {opt.macros.proteinG}g
                        </span>
                        <span className="text-kallo-text-muted">
                          C {opt.macros.carbsG}g
                        </span>
                        <span className="text-kallo-text-muted">
                          F {opt.macros.fatG}g
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </FormControl>
            </SettingsRow>
          </FormItem>
        )}
      />
    </>
  );
}
