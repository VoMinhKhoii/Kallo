'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { bodyMetricsSchema, goalSchema } from '@/lib/onboarding/schemas';
import { calcBMR, calcDailyTargets, calcTDEE } from '@/lib/onboarding/tdee';
import type {
  ActivityLevel,
  Aggression,
  CarbSplit,
  Goal,
} from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

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
  desc: string;
}[] = [
  {
    value: 'sedentary',
    label: 'Ít vận động',
    desc: 'Ít hoặc không tập, công việc văn phòng',
  },
  {
    value: 'light',
    label: 'Nhẹ nhàng',
    desc: 'Tập nhẹ 1-3 ngày/tuần',
  },
  {
    value: 'moderate',
    label: 'Vừa phải',
    desc: 'Tập vừa 3-5 ngày/tuần',
  },
  {
    value: 'very_active',
    label: 'Rất năng động',
    desc: 'Tập nặng 6-7 ngày/tuần',
  },
];

const GOAL_LABELS: Record<Goal, string> = {
  maintaining: 'Duy trì',
  cutting: 'Giảm cân',
  bulking: 'Tăng cân',
};

const CARB_SPLIT_LABELS: Record<CarbSplit, string> = {
  moderate_carb: 'Carb vừa',
  lower_carb: 'Ít carb',
  higher_carb: 'Nhiều carb',
};

const AGGRESSION_OPTIONS: {
  value: Aggression;
  label: string;
  desc: string;
}[] = [
  {
    value: 'gentle',
    label: 'Nhẹ nhàng',
    desc: '~0.25 kg/week (~275 kcal/day)',
  },
  {
    value: 'moderate',
    label: 'Vừa phải',
    desc: '~0.5 kg/week (~550 kcal/day)',
  },
  {
    value: 'aggressive',
    label: 'Mạnh',
    desc: '~0.75 kg/week (~825 kcal/day)',
  },
];

const GOALS: Goal[] = ['maintaining', 'cutting', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

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
      aggression: defaultValues.aggression ?? 'moderate',
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

  // Reference matrix: 3×3 grid (always moderate aggression)
  const matrix = useMemo(() => {
    if (tdee === null) return null;
    const grid: Record<
      string,
      Record<string, ReturnType<typeof calcDailyTargets>>
    > = {};
    for (const g of GOALS) {
      grid[g] = {};
      for (const cs of CARB_SPLITS) {
        grid[g][cs] = calcDailyTargets(tdee, g, 'moderate', cs);
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

  // TDEE warning
  const tdeeWarning = tdee !== null && (tdee < 800 || tdee > 5000);

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

  // Report on mount if data pre-filled
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (tdee !== null && finalTargets) {
      reportChange();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Report whenever finalTargets or tdee changes
  // (triggered by select/radio changes or blur)
  useEffect(() => {
    if (tdee !== null && finalTargets) {
      reportChange();
    }
  }, [tdee, finalTargets, reportChange]);

  const showFineTuning = tdee !== null && values.goal !== 'maintaining';

  const displayTargets =
    tdee !== null
      ? values.goal !== 'maintaining'
        ? finalTargets
        : (matrix?.[values.goal]?.[values.carbSplit] ?? null)
      : null;

  return (
    <Form {...form}>
      <form className="space-y-10">
        {/* Header */}
        <div>
          <h2
            className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Body Metrics &amp; Targets
          </h2>
          <p className="text-[#8B8682] text-[15px] leading-relaxed">
            We calculate your Total Daily Energy Expenditure (TDEE) locally. No
            data leaves your device.
          </p>
        </div>

        {/* Body Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Sex — select dropdown */}
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
                    <select
                      className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        reportChange();
                      }}
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
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
                    className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
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
                    className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
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
                    className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Activity Level — full-width select */}
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
                    <select
                      className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        reportChange();
                      }}
                    >
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.desc}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* TDEE + Goal + Targets (visible once metrics filled) */}
        {tdee !== null && (
          <div className="space-y-8 border-[#EAE7E0] border-t pt-6">
            {/* Centered TDEE */}
            <div className="text-center">
              <span className="mb-1 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                Your Estimated TDEE
              </span>
              <div
                className="font-normal text-4xl text-[#2C2416] tracking-tighter"
                style={{ fontFamily: 'Lora, serif' }}
              >
                ~{Math.round(tdee).toLocaleString()}{' '}
                <span className="font-sans text-[#8B8682] text-lg">kcal</span>
              </div>
              {tdeeWarning && (
                <p className="mt-2 text-[12px] text-amber-600">
                  This value looks unusual. Double-check your inputs above.
                </p>
              )}
              {!tdeeWarning && (
                <p className="mt-2 text-[#A8A29E] text-[12px]">
                  Mifflin-St Jeor formula. Something look off? Adjust above.
                </p>
              )}
            </div>

            {/* Goal segmented control */}
            <div className="space-y-4">
              <label className="block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                Select Goal
              </label>
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex rounded-xl bg-[#EAE7E0]/40 p-1">
                        {GOALS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              field.onChange(g);
                              reportChange();
                            }}
                            className={`flex-1 rounded-lg py-2 font-medium text-[14px] transition-all ${
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

              {/* Aggression cards (if not maintaining) */}
              {showFineTuning && (
                <div className="pt-2">
                  <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                    Aggression
                  </label>
                  <FormField
                    control={form.control}
                    name="aggression"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="grid grid-cols-3 gap-2">
                            {AGGRESSION_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  field.onChange(opt.value);
                                  reportChange();
                                }}
                                className={`rounded-xl border p-3 text-left transition-all ${
                                  field.value === opt.value
                                    ? 'border-[#C9A87C] bg-[#C9A87C]/5'
                                    : 'border-[#EAE7E0] hover:border-[#C9A87C]/50'
                                }`}
                              >
                                <div className="font-medium text-[#2C2416] text-[13px]">
                                  {opt.label}
                                </div>
                                <div className="mt-0.5 text-[#8B8682] text-[11px]">
                                  {opt.desc}
                                </div>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Deficit override */}
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="flex items-center gap-1 font-medium text-[#C9A87C] text-[12px] hover:text-[#2C2416]">
                      <ChevronDown className="h-3.5 w-3.5" />
                      Custom kcal override
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <FormField
                        control={form.control}
                        name="deficitOverride"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <input
                                type="number"
                                placeholder="e.g. 400"
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  field.onChange(v === '' ? null : Number(v));
                                }}
                                onBlur={() => {
                                  field.onBlur();
                                  reportChange();
                                }}
                                className="w-40 rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>

            {/* Daily target card + carb split */}
            {displayTargets && (
              <div className="rounded-2xl border border-[#EAE7E0] bg-white p-6">
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <label className="mb-1 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      Daily Target
                    </label>
                    <div
                      className="font-normal text-3xl text-[#2C2416]"
                      style={{
                        fontFamily: 'Lora, serif',
                      }}
                    >
                      {Math.round(displayTargets.calories)}{' '}
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
                          <select
                            className="cursor-pointer border-none bg-transparent text-right font-medium text-[#C9A87C] text-[13px] outline-none"
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              reportChange();
                            }}
                          >
                            {CARB_SPLITS.map((cs) => (
                              <option key={cs} value={cs}>
                                {CARB_SPLIT_LABELS[cs]}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* 3 macro cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-[#F5F4F0] p-3 text-center">
                    <div className="mb-1 font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                      Protein
                    </div>
                    <div className="font-medium font-mono text-[#2C2416] text-[17px]">
                      {Math.round(displayTargets.proteinG)}g
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F5F4F0] p-3 text-center">
                    <div className="mb-1 font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                      Carbs
                    </div>
                    <div className="font-medium font-mono text-[#2C2416] text-[17px]">
                      {Math.round(displayTargets.carbsG)}g
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F5F4F0] p-3 text-center">
                    <div className="mb-1 font-bold text-[#A8A29E] text-[10px] uppercase tracking-widest">
                      Fat
                    </div>
                    <div className="font-medium font-mono text-[#2C2416] text-[17px]">
                      {Math.round(displayTargets.fatG)}g
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reference matrix (collapsible) */}
            {matrix && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 font-medium text-[#8B8682] text-[12px] hover:text-[#2C2416]">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Reference matrix (all combos)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="overflow-x-auto rounded-xl border border-[#EAE7E0]">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-[#EAE7E0] border-b bg-[#F5F4F0]">
                          <th className="px-3 py-2 text-left font-bold text-[#A8A29E] uppercase tracking-widest">
                            Goal
                          </th>
                          {CARB_SPLITS.map((cs) => (
                            <th
                              key={cs}
                              className="px-3 py-2 text-center font-bold text-[#A8A29E] uppercase tracking-widest"
                            >
                              {CARB_SPLIT_LABELS[cs]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {GOALS.map((g) => (
                          <tr
                            key={g}
                            className={cn(
                              'border-[#EAE7E0] border-b last:border-0',
                              g === values.goal && 'bg-[#C9A87C]/5'
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-[#2C2416]">
                              {GOAL_LABELS[g]}
                            </td>
                            {CARB_SPLITS.map((cs) => {
                              const t = matrix[g]?.[cs];
                              const isActive =
                                g === values.goal && cs === values.carbSplit;
                              return (
                                <td
                                  key={cs}
                                  className={cn(
                                    'px-3 py-2 text-center',
                                    isActive
                                      ? 'font-medium text-[#2C2416]'
                                      : 'text-[#8B8682]'
                                  )}
                                >
                                  {t ? `${Math.round(t.calories)} kcal` : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </form>
    </Form>
  );
}
