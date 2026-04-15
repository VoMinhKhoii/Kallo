'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/onboarding/constants';
import { bodyMetricsSchema, goalSchema } from '@/lib/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/onboarding/tdee';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';

// Merged schema for screen 1
const screen1Schema = bodyMetricsSchema.merge(goalSchema);
type Screen1FormData = z.infer<typeof screen1Schema>;

export interface ScreenOneData extends Screen1FormData {
  tdeeKcal: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

interface ScreenBodyMetricsProps {
  defaultValues: Partial<ScreenOneData>;
  onChange: (data: ScreenOneData) => void;
}

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
}[] = [
  {
    value: 'sedentary',
    label: 'Sedentary (Office job, little to no exercise)',
  },
  {
    value: 'light',
    label: 'Lightly active (Light exercise 1-3 days/week)',
  },
  {
    value: 'moderate',
    label: 'Moderately active (Moderate exercise 3-5 days/week)',
  },
  {
    value: 'very_active',
    label: 'Very active (Heavy exercise 6-7 days/week)',
  },
];

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

const CARB_SPLIT_INFO: Record<CarbSplit, { label: string; desc: string }> = {
  moderate_carb: {
    label: 'Moderate Carb',
    desc: 'Balanced (30/35/35)',
  },
  lower_carb: {
    label: 'Lower Carb',
    desc: 'High Protein (40/40/20)',
  },
  higher_carb: {
    label: 'Higher Carb',
    desc: 'Active (30/20/50)',
  },
};

const GOAL_LABELS: Record<Goal, string> = {
  maintaining: 'Maintenance',
  cutting: 'Cutting',
  bulking: 'Bulking',
};

// Custom dropdown matching the Apple Notes aesthetic
function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-[#2C2416] text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
          isOpen
            ? 'border-[#C9A87C] shadow-sm ring-1 ring-[#C9A87C]/20'
            : 'border-[#EAE7E0] hover:border-[#C9A87C]/50'
        }`}
      >
        <span className="truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#8B8682] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-110"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute top-full right-0 left-0 z-120 mt-1.5 overflow-hidden rounded-xl border border-[#EAE7E0] bg-white py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[#2C2416] text-[14px] transition-colors hover:bg-[#F5F4F0]"
                >
                  <span className={value === opt.value ? 'font-medium' : ''}>
                    {opt.label}
                  </span>
                  {value === opt.value && (
                    <Check className="h-4 w-4 text-[#C9A87C]" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ScreenBodyMetrics({
  defaultValues,
  onChange,
}: ScreenBodyMetricsProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const form = useForm<Screen1FormData>({
    resolver: zodResolver(screen1Schema),
    defaultValues: {
      biologicalSex: defaultValues.biologicalSex,
      weightKg: defaultValues.weightKg,
      heightCm: defaultValues.heightCm,
      age: defaultValues.age,
      activityLevel: defaultValues.activityLevel ?? 'light',
      goal: defaultValues.goal ?? 'maintaining',
      aggression: defaultValues.aggression ?? 0.5,
      carbSplit: defaultValues.carbSplit ?? 'moderate_carb',
      deficitOverride: defaultValues.deficitOverride ?? null,
    },
    mode: 'onBlur',
  });

  const values = form.watch();

  // Check if all body metric fields are filled
  const allMetricsFilled = !!(
    values.biologicalSex &&
    values.weightKg &&
    values.heightCm &&
    values.age &&
    values.activityLevel
  );

  // Compute BMR and TDEE
  const bmr = allMetricsFilled
    ? calcBMR({
        biologicalSex: values.biologicalSex,
        weightKg: values.weightKg,
        heightCm: values.heightCm,
        age: values.age,
        activityLevel: values.activityLevel,
      })
    : null;
  const tdee = bmr !== null ? calcTDEE(bmr, values.activityLevel) : null;

  // Reference matrix: compute macros for each goal × carbSplit
  const _matrix = useMemo(() => {
    if (tdee === null) return null;
    const grid: Record<
      string,
      Record<string, ReturnType<typeof calcDailyTargets>>
    > = {};
    for (const g of GOALS) {
      grid[g] = {};
      for (const cs of CARB_SPLITS) {
        grid[g][cs] = calcDailyTargets(tdee, g, 0.5, cs);
      }
    }
    return grid;
  }, [tdee]);

  // Final targets for fine-tuning section
  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(
      tdee,
      values.goal,
      values.aggression,
      values.carbSplit,
      values.deficitOverride
    );
  }, [
    tdee,
    values.goal,
    values.aggression,
    values.carbSplit,
    values.deficitOverride,
  ]);

  // Target calories based on goal + aggression
  const targetCalories = finalTargets?.calories ?? 0;

  // Carb split options with computed macros
  const carbOptions = useMemo(
    () =>
      CARB_SPLITS.map((cs) => {
        const macros = calcMacroGrams(targetCalories, cs);
        const info = CARB_SPLIT_INFO[cs];
        return {
          id: cs,
          label: info.label,
          desc: info.desc,
          macros,
        };
      }),
    [targetCalories]
  );

  // Report data upstream on discrete changes
  const reportChange = useCallback(() => {
    const v = form.getValues();
    if (tdee === null || !finalTargets) return;
    onChangeRef.current({
      ...v,
      tdeeKcal: tdee,
      calorieTarget: finalTargets.calories,
      proteinTargetG: finalTargets.proteinG,
      carbsTargetG: finalTargets.carbsG,
      fatTargetG: finalTargets.fatG,
    });
  }, [form, tdee, finalTargets]);

  // Report whenever finalTargets or tdee changes (also covers mount with pre-filled data)
  useEffect(() => {
    if (tdee !== null && finalTargets) {
      reportChange();
    }
  }, [tdee, finalTargets, reportChange]);

  const inputClass =
    'w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[14px] text-[#2C2416] transition-colors hover:border-[#C9A87C]/50 focus-visible:border-[#C9A87C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/20';

  return (
    <Form {...form}>
      <form className="space-y-5 lg:space-y-6">
        <div className="max-w-xl">
          <h2 className="mb-1.5 font-medium font-serif text-2xl text-[#2C2416] tracking-tight">
            Body Metrics &amp; Targets
          </h2>
          <p className="text-[#8B8682] text-[14px] leading-relaxed">
            Fill the basics first. Once they&apos;re complete, your calorie
            target and macro split unlock beside them on larger screens.
          </p>
        </div>

        <div
          className={
            tdee !== null
              ? 'space-y-5 lg:grid lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] lg:items-start lg:gap-5 lg:space-y-0'
              : 'space-y-5'
          }
        >
          <section className="rounded-[28px] border border-[#EAE7E0] bg-white p-5">
            <div className="mb-4">
              <div>
                <p className="font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                  About You
                </p>
                <p className="mt-1 text-[#8B8682] text-[13px] leading-relaxed">
                  These stay optional, but once you fill them in, Nhẩm can
                  compute more tailored targets locally.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <FormField
                  control={form.control}
                  name="biologicalSex"
                  render={({ field }) => (
                    <FormItem>
                      <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                        Sex
                      </label>
                      <FormControl>
                        <CustomSelect
                          value={field.value ?? ''}
                          onChange={(v) => {
                            field.onChange(v);
                            reportChange();
                          }}
                          options={[
                            { label: 'Male', value: 'male' },
                            { label: 'Female', value: 'female' },
                          ]}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      Weight (kg)
                    </label>
                    <FormControl>
                      <input
                        type="number"
                        placeholder="65"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      Height (cm)
                    </label>
                    <FormControl>
                      <input
                        type="number"
                        placeholder="170"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      Age
                    </label>
                    <FormControl>
                      <input
                        type="number"
                        placeholder="25"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="col-span-2 sm:col-span-4">
                <FormField
                  control={form.control}
                  name="activityLevel"
                  render={({ field }) => (
                    <FormItem>
                      <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                        Activity Level
                      </label>
                      <FormControl>
                        <CustomSelect
                          value={field.value ?? ''}
                          onChange={(v) => {
                            field.onChange(v);
                            reportChange();
                          }}
                          options={ACTIVITY_OPTIONS.map((opt) => ({
                            label: opt.label,
                            value: opt.value,
                          }))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          {tdee !== null ? (
            <section className="space-y-4 rounded-[28px] border border-[#EAE7E0] bg-white p-5">
              <div className="flex flex-col gap-4 border-[#EAE7E0]/80 border-b pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <span className="mb-1 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                    Your Estimated TDEE
                  </span>
                  <div className="font-normal font-serif text-4xl text-[#2C2416] tracking-tighter">
                    ~{Math.round(tdee).toLocaleString()}{' '}
                    <span className="font-sans text-[#8B8682] text-lg">
                      kcal
                    </span>
                  </div>
                </div>

                <div className="w-full xl:w-auto">
                  <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                    Select Goal
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
                </div>
              </div>

              {values.goal !== 'maintaining' && (
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
                              <label className="block font-bold text-[#2C2416] text-[13px]">
                                Pace &amp; Aggression
                              </label>
                              <div className="font-medium text-[#2C2416] text-[14px]">
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
                                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#EAE7E0] accent-[#2C2416]"
                              />
                              <div className="mt-2.5 flex justify-between text-[#8B8682] text-[11px]">
                                <span
                                  className={
                                    aggressionKg <= 0.3
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  Gentle
                                </span>
                                <span
                                  className={
                                    aggressionKg > 0.3 && aggressionKg <= 0.6
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  Moderate
                                </span>
                                <span
                                  className={
                                    aggressionKg > 0.6
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  Aggressive
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg bg-[#F5F4F0] px-3 py-2 text-center text-[#A8A29E] text-[12px]">
                              Translates to a{' '}
                              <span className="font-medium text-[#2C2416]">
                                ~
                                {Math.round(
                                  aggressionKg * AGGRESSION_KCAL_PER_KG
                                )}{' '}
                                kcal/day
                              </span>{' '}
                              {values.goal === 'cutting'
                                ? 'deficit'
                                : 'surplus'}
                              .
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              )}

              {targetCalories > 0 && (
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label className="block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      Daily Target &amp; Macros
                    </label>
                    <div className="font-normal font-serif text-2xl text-[#2C2416]">
                      {targetCalories}{' '}
                      <span className="font-sans text-[#8B8682] text-sm">
                        kcal
                      </span>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="carbSplit"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="grid gap-2.5 lg:grid-cols-3">
                            {carbOptions.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  field.onChange(opt.id);
                                  reportChange();
                                }}
                                className={`overflow-hidden rounded-[22px] border text-left transition-all ${
                                  field.value === opt.id
                                    ? 'border-[#C9A87C] bg-[#FFF8EF] shadow-[0_10px_24px_rgba(201,168,124,0.14)]'
                                    : 'border-[#EAE7E0] bg-white hover:border-[#C9A87C]/50'
                                }`}
                              >
                                <div
                                  className={`px-3.5 py-2.5 ${
                                    field.value === opt.id
                                      ? 'bg-[#FBF2E6] text-[#2C2416]'
                                      : 'bg-[#F5F4F0] text-[#2C2416]'
                                  }`}
                                >
                                  <div className="font-medium text-[13px]">
                                    {opt.label}
                                  </div>
                                  <div
                                    className={`mt-0.5 text-[10px] ${
                                      field.value === opt.id
                                        ? 'text-[#6F6556]'
                                        : 'text-[#8B8682]'
                                    }`}
                                  >
                                    {opt.desc}
                                  </div>
                                </div>
                                <div className="px-3.5 py-3">
                                  <div className="space-y-1.5 text-[11px]">
                                    {[
                                      {
                                        label: 'protein',
                                        value: opt.macros.proteinG,
                                      },
                                      {
                                        label: 'fats',
                                        value: opt.macros.fatG,
                                      },
                                      {
                                        label: 'carbs',
                                        value: opt.macros.carbsG,
                                      },
                                    ].map((macro) => (
                                      <div
                                        key={macro.label}
                                        className="flex items-center justify-between gap-3"
                                      >
                                        <span className="text-[#6F6556] text-[10px] uppercase tracking-wide">
                                          {macro.label}
                                        </span>
                                        <span className="font-semibold text-[#2C2416] text-[12px]">
                                          {macro.value}g
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </section>
          ) : (
            <div className="rounded-[28px] border border-[#EAE7E0] border-dashed bg-[#FFFCF8] p-5">
              <p className="font-medium text-[#2C2416] text-[14px]">
                Fill the basics to unlock targets.
              </p>
              <p className="mt-1 text-[#8B8682] text-[13px] leading-relaxed">
                Once sex, weight, height, age, and activity are filled, this
                side turns into your live calorie target and macro planner.
              </p>
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
