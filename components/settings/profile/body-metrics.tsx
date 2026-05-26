'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { CustomSelect } from '@/components/settings/custom-select';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/onboarding/constants';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/onboarding/tdee';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';
import type { ProfileFormValues } from './index';

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

const inputClass =
  'w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[14px] text-[#2C2416] transition-colors hover:border-[#C9A87C]/50 focus:border-[#C9A87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40';

export function BodyMetrics() {
  const t = useTranslations('onboarding.bodyMetrics');
  const form = useFormContext<ProfileFormValues>();

  const ACTIVITY_OPTIONS = [
    { value: 'sedentary', label: t('sedentary') },
    { value: 'light', label: t('light') },
    { value: 'moderate', label: t('moderate') },
    { value: 'very_active', label: t('veryActive') },
  ];

  const GOAL_LABELS: Record<Goal, string> = {
    maintaining: t('maintaining'),
    cutting: t('cutting'),
    bulking: t('bulking'),
  };

  const CARB_SPLIT_INFO: Record<CarbSplit, { label: string; desc: string }> =
    useMemo(
      () => ({
        moderate_carb: {
          label: t('moderateCarb'),
          desc: t('moderateCarbDescription'),
        },
        lower_carb: {
          label: t('lowerCarb'),
          desc: t('lowerCarbDescription'),
        },
        higher_carb: {
          label: t('higherCarb'),
          desc: t('higherCarbDescription'),
        },
      }),
      [t]
    );

  const watchSex = useWatch({ name: 'biologicalSex' });
  const watchWeight = useWatch({ name: 'weightKg' });
  const watchHeight = useWatch({ name: 'heightCm' });
  const watchAge = useWatch({ name: 'age' });
  const watchActivity = useWatch({ name: 'activityLevel' });
  const watchGoal = useWatch({ name: 'goal' });
  const watchAggression = useWatch({ name: 'aggression' });
  const watchCarbSplit = useWatch({ name: 'carbSplit' });

  const allMetricsFilled = !!(
    watchSex &&
    watchWeight &&
    watchHeight &&
    watchAge &&
    watchActivity
  );

  const tdee = useMemo(() => {
    if (!allMetricsFilled) return null;
    const bmr = calcBMR({
      biologicalSex: watchSex,
      weightKg: watchWeight,
      heightCm: watchHeight,
      age: watchAge,
      activityLevel: watchActivity as ActivityLevel,
    });
    return calcTDEE(bmr, watchActivity as ActivityLevel);
  }, [
    watchSex,
    watchWeight,
    watchHeight,
    watchAge,
    watchActivity,
    allMetricsFilled,
  ]);

  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(tdee, watchGoal, watchAggression, watchCarbSplit);
  }, [tdee, watchGoal, watchAggression, watchCarbSplit]);

  const targetCalories = finalTargets?.calories ?? 0;

  const carbOptions = useMemo(
    () =>
      CARB_SPLITS.map((cs) => {
        const macros = calcMacroGrams(targetCalories, cs);
        const info = CARB_SPLIT_INFO[cs];
        return { id: cs, label: info.label, desc: info.desc, macros };
      }),
    [targetCalories, CARB_SPLIT_INFO]
  );

  const macros = useMemo(() => {
    if (!targetCalories) return null;
    return calcMacroGrams(targetCalories, watchCarbSplit);
  }, [targetCalories, watchCarbSplit]);

  return (
    <div className="space-y-8">
      {/* Body metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Sex */}
        <div className="col-span-2 sm:col-span-1">
          <FormField
            control={form.control}
            name="biologicalSex"
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                  {t('biologicalSex')}
                </label>
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

        {/* Weight */}
        <FormField
          control={form.control}
          name="weightKg"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                {t('weight')} ({t('weightUnit')})
              </label>
              <FormControl>
                <input
                  type="number"
                  placeholder="65"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? undefined : Number(v));
                  }}
                  onBlur={field.onBlur}
                  className={inputClass}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Height */}
        <FormField
          control={form.control}
          name="heightCm"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                {t('height')} ({t('heightUnit')})
              </label>
              <FormControl>
                <input
                  type="number"
                  placeholder="170"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? undefined : Number(v));
                  }}
                  onBlur={field.onBlur}
                  className={inputClass}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Age */}
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                {t('age')}
              </label>
              <FormControl>
                <input
                  type="number"
                  placeholder="25"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? undefined : Number(v));
                  }}
                  onBlur={field.onBlur}
                  className={inputClass}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Activity Level */}
        <div className="col-span-2 sm:col-span-4">
          <FormField
            control={form.control}
            name="activityLevel"
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                  {t('activityLevel')}
                </label>
                <FormControl>
                  <CustomSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={ACTIVITY_OPTIONS}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Goal → pace → split → target (only once metrics produce a TDEE) */}
      {tdee !== null && (
        <div className="space-y-8 border-[#EAE7E0] border-t pt-6">
          {/* Goal */}
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                  {t('goal')}
                </label>
                <FormControl>
                  <div className="flex w-full gap-1 rounded-xl bg-[#EAE7E0]/40 p-1">
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
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
                        className={`flex-1 rounded-lg px-2 py-2 text-center font-medium text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40 ${
                          field.value === g
                            ? 'bg-white text-[#2C2416] shadow-sm'
                            : 'text-[#8B8682] hover:text-[#2C2416]'
                        }`}
                      >
                        {GOAL_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Aggression */}
          {watchGoal !== 'maintaining' && (
            <FormField
              control={form.control}
              name="aggression"
              render={({ field }) => {
                const aggressionKg = field.value ?? 0.5;
                const kcalDelta = Math.round(
                  aggressionKg * AGGRESSION_KCAL_PER_KG
                );
                return (
                  <FormItem>
                    <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      {t('aggressionLabel')} (
                      {watchGoal === 'cutting'
                        ? t('aggressionDeficit')
                        : t('aggressionSurplus')}
                      )
                    </label>
                    <div className="space-y-3 rounded-2xl border border-[#EAE7E0] bg-white p-5">
                      {/* Readout on its own line so it never collides with the end labels */}
                      <div className="text-center font-medium text-[#2C2416] text-[15px]">
                        {aggressionKg.toFixed(2)} {t('weightUnit')}/wk
                        <span className="text-[#8B8682]"> · </span>
                        {watchGoal === 'cutting' ? '−' : '+'}
                        {kcalDelta} {t('perDay')}
                      </div>
                      <FormControl>
                        <input
                          type="range"
                          min={0.1}
                          max={0.8}
                          step={0.05}
                          value={aggressionKg}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          aria-label={t('aggressionLabel')}
                          className="w-full accent-[#C9A87C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40"
                        />
                      </FormControl>
                      <div className="flex items-center justify-between text-[#8B8682] text-[12px]">
                        <span>{t('aggressionLow')}</span>
                        <span>{t('aggressionHigh')}</span>
                      </div>
                    </div>
                  </FormItem>
                );
              }}
            />
          )}

          {/* Carb Split */}
          <div>
            <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
              {t('carbSplit')}
            </label>
            <FormField
              control={form.control}
              name="carbSplit"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {carbOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => field.onChange(opt.id)}
                          className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40 ${
                            field.value === opt.id
                              ? 'border-[#C9A87C] bg-[#C9A87C]/5 shadow-sm'
                              : 'border-[#EAE7E0] bg-white hover:border-[#C9A87C]/50'
                          }`}
                        >
                          <span className="font-medium text-[#2C2416] text-[14px]">
                            {opt.label}
                          </span>
                          <span className="text-[#8B8682] text-[11px]">
                            {opt.desc}
                          </span>
                          <div className="mt-1 flex gap-3 text-[11px]">
                            <span className="text-[#8B8682]">
                              P {opt.macros.proteinG}g
                            </span>
                            <span className="text-[#8B8682]">
                              C {opt.macros.carbsG}g
                            </span>
                            <span className="text-[#8B8682]">
                              F {opt.macros.fatG}g
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Hero: daily target is the headline; TDEE is the supporting caption */}
          {macros && (
            <div className="rounded-2xl border border-[#C9A87C]/40 bg-gradient-to-b from-[#C9A87C]/[0.07] to-transparent p-6 text-center">
              <span className="block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                {t('calorieTarget')}
              </span>
              <div className="mt-1 font-serif text-4xl text-[#2C2416] tracking-tighter sm:text-5xl">
                {Math.round(targetCalories).toLocaleString()}{' '}
                <span className="font-sans text-[#8B8682] text-lg">
                  {t('kcal')}
                </span>
              </div>
              <p className="mt-1.5 text-[#8B8682] text-[12px]">
                {t('basedOnTdee')} ~{Math.round(tdee).toLocaleString()}{' '}
                {t('kcal')}
                {watchGoal === 'maintaining' ? (
                  <> · {t('maintenance')}</>
                ) : (
                  <>
                    {' · '}
                    {watchGoal === 'cutting' ? '−' : '+'}
                    {Math.abs(
                      Math.round(tdee) - Math.round(targetCalories)
                    ).toLocaleString()}{' '}
                    {t('perDay')}{' '}
                    {watchGoal === 'cutting'
                      ? t('aggressionDeficit')
                      : t('aggressionSurplus')}
                  </>
                )}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-4 border-[#C9A87C]/20 border-t pt-4">
                <div>
                  <div className="font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                    {t('protein')}
                  </div>
                  <div className="font-medium text-[#2C2416] text-lg">
                    {macros.proteinG}g
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                    {t('carbs')}
                  </div>
                  <div className="font-medium text-[#2C2416] text-lg">
                    {macros.carbsG}g
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                    {t('fat')}
                  </div>
                  <div className="font-medium text-[#2C2416] text-lg">
                    {macros.fatG}g
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
