'use client';

import {
  Fragment,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  bodyMetricsSchema,
  goalSchema,
} from '@/lib/onboarding/schemas';
import {
  calcBMR,
  calcTDEE,
  calcDailyTargets,
} from '@/lib/onboarding/tdee';
import { AGGRESSION_PRESETS } from '@/lib/onboarding/constants';
import type {
  Goal,
  CarbSplit,
  Aggression,
  ActivityLevel,
} from '@/lib/onboarding/types';

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
    label: 'Sedentary',
    desc: 'Little or no exercise, desk job',
  },
  {
    value: 'light',
    label: 'Lightly active',
    desc: 'Light exercise 1-3 days/week',
  },
  {
    value: 'moderate',
    label: 'Moderately active',
    desc: 'Moderate exercise 3-5 days/week',
  },
  {
    value: 'very_active',
    label: 'Very active',
    desc: 'Hard exercise 6-7 days/week',
  },
];

const GOAL_LABELS: Record<Goal, string> = {
  maintaining: 'Maintenance',
  cutting: 'Cutting',
  bulking: 'Bulking',
};

const CARB_SPLIT_LABELS: Record<CarbSplit, string> = {
  moderate_carb: 'Moderate Carb',
  lower_carb: 'Lower Carb',
  higher_carb: 'Higher Carb',
};

const AGGRESSION_OPTIONS: {
  value: Aggression;
  label: string;
  desc: string;
}[] = [
  {
    value: 'gentle',
    label: 'Gentle',
    desc: '~0.25 kg/week (~275 kcal/day)',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    desc: '~0.5 kg/week (~550 kcal/day)',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    desc: '~0.75 kg/week (~825 kcal/day)',
  },
];

const GOALS: Goal[] = [
  'maintaining',
  'cutting',
  'bulking',
];
const CARB_SPLITS: CarbSplit[] = [
  'moderate_carb',
  'lower_carb',
  'higher_carb',
];

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
      activityLevel:
        defaultValues.activityLevel ?? 'light',
      goal: defaultValues.goal ?? 'maintaining',
      aggression:
        defaultValues.aggression ?? 'moderate',
      carbSplit:
        defaultValues.carbSplit ?? 'moderate_carb',
      deficitOverride:
        defaultValues.deficitOverride ?? null,
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
  const tdee =
    bmr !== null
      ? calcTDEE(bmr, values.activityLevel)
      : null;

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
        grid[g][cs] = calcDailyTargets(
          tdee,
          g,
          'moderate',
          cs,
        );
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
      values.deficitOverride,
    );
  }, [
    tdee,
    values.goal,
    values.aggression,
    values.carbSplit,
    values.deficitOverride,
  ]);

  // TDEE warning
  const tdeeWarning =
    tdee !== null && (tdee < 800 || tdee > 5000);

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

  const showFineTuning =
    tdee !== null && values.goal !== 'maintaining';

  // Targets to display (use finalTargets for cutting/bulking,
  // matrix maintenance for maintaining)
  const displayTargets =
    tdee !== null
      ? values.goal !== 'maintaining'
        ? finalTargets
        : matrix?.[values.goal]?.[values.carbSplit] ??
          null
      : null;

  return (
    <Form {...form}>
      <form className="space-y-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* LEFT COLUMN: Form inputs */}
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-lg">
                Body Metrics
              </h2>
              {tdee !== null && (
                <p className="mt-1 text-muted-foreground text-sm">
                  Something look off? Adjust above
                </p>
              )}
            </div>

            {/* Biological Sex */}
            <FormField
              control={form.control}
              name="biologicalSex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biological Sex</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(v) => {
                        field.onChange(v);
                        reportChange();
                      }}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="male" />
                        <Label>Male</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="female" />
                        <Label>Female</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Weight */}
            <FormField
              control={form.control}
              name="weightKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="70"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(
                          v === ''
                            ? undefined
                            : Number(v),
                        );
                      }}
                      onBlur={(e) => {
                        field.onBlur();
                        if (e.target.value) {
                          reportChange();
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Height */}
            <FormField
              control={form.control}
              name="heightCm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height (cm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="170"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(
                          v === ''
                            ? undefined
                            : Number(v),
                        );
                      }}
                      onBlur={(e) => {
                        field.onBlur();
                        if (e.target.value) {
                          reportChange();
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Age */}
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="25"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(
                          v === ''
                            ? undefined
                            : Number(v),
                        );
                      }}
                      onBlur={(e) => {
                        field.onBlur();
                        if (e.target.value) {
                          reportChange();
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Activity Level */}
            <FormField
              control={form.control}
              name="activityLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Level</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select activity level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                        >
                          <span className="font-medium">
                            {opt.label}
                          </span>
                          <span className="ml-1 text-muted-foreground text-xs">
                            — {opt.desc}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="mt-8 space-y-6 lg:mt-0">
            {/* TDEE Results */}
            {tdee !== null && bmr !== null && (
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">
                  Your TDEE
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-muted-foreground text-sm">
                      BMR
                    </p>
                    <p className="font-bold text-2xl">
                      {Math.round(bmr)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      kcal/day
                    </p>
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-4">
                    <p className="text-muted-foreground text-sm">
                      TDEE
                    </p>
                    <p className="font-bold text-2xl text-primary">
                      {tdee}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      kcal/day
                    </p>
                  </div>
                </div>

                {tdeeWarning && (
                  <p className="text-muted-foreground text-sm">
                    These numbers look unusual —
                    double-check your inputs
                  </p>
                )}

                {/* Formula collapsible */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground">
                    <ChevronDown className="h-4 w-4" />
                    Mifflin-St Jeor formula
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs">
                    <p className="font-mono">
                      Male: (10 × kg) + (6.25 × cm) - (5
                      × age) + 5
                    </p>
                    <p className="font-mono">
                      Female: (10 × kg) + (6.25 × cm) -
                      (5 × age) - 161
                    </p>
                    <p className="mt-1">
                      TDEE = BMR × activity multiplier
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Reference Matrix */}
            {matrix && tdee !== null && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-base">
                    Macro Targets
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Shown at moderate pace — adjust below
                  </p>
                </div>

                {/* Matrix grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {/* Header row */}
                  <div />
                  {CARB_SPLITS.map((cs) => (
                    <div
                      key={cs}
                      className="text-center font-medium text-xs"
                    >
                      {CARB_SPLIT_LABELS[cs]}
                    </div>
                  ))}

                  {/* Data rows */}
                  {GOALS.map((g) => (
                    <Fragment key={g}>
                      <div
                        className="flex items-center pr-1 font-medium text-xs"
                      >
                        {GOAL_LABELS[g]}
                      </div>
                      {CARB_SPLITS.map((cs) => {
                        const cell =
                          matrix[g]?.[cs];
                        if (!cell) return null;
                        const isSelected =
                          values.goal === g &&
                          values.carbSplit === cs;
                        return (
                          <button
                            key={`${g}-${cs}`}
                            type="button"
                            className={cn(
                              'rounded-md border p-2 text-left transition-all',
                              'hover:border-primary/50 hover:bg-primary/5',
                              isSelected
                                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                : 'border-border bg-card',
                            )}
                            onClick={() => {
                              form.setValue(
                                'goal',
                                g,
                              );
                              form.setValue(
                                'carbSplit',
                                cs,
                              );
                              // Reset aggression
                              // defaults when
                              // switching goals
                              if (
                                g !== 'maintaining'
                              ) {
                                if (
                                  !values.aggression
                                ) {
                                  form.setValue(
                                    'aggression',
                                    'moderate',
                                  );
                                }
                                form.setValue(
                                  'deficitOverride',
                                  null,
                                );
                              }
                              reportChange();
                            }}
                          >
                            <p className="font-bold text-sm">
                              {cell.calories}
                            </p>
                            <div className="mt-0.5 space-y-0 text-muted-foreground text-[10px] leading-tight">
                              <p>
                                P: {cell.proteinG}g
                              </p>
                              <p>
                                C: {cell.carbsG}g
                              </p>
                              <p>
                                F: {cell.fatG}g
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Fine-tuning (cutting/bulking only) */}
            {showFineTuning && (
              <div className="space-y-4">
                <h3 className="font-semibold text-base">
                  Fine-tuning
                </h3>

                {/* Aggression Level */}
                <FormField
                  control={form.control}
                  name="aggression"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {values.goal === 'cutting'
                          ? 'Deficit'
                          : 'Surplus'}{' '}
                        Pace
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(
                            v: string,
                          ) => {
                            field.onChange(v);
                            // Reset override to
                            // new preset
                            form.setValue(
                              'deficitOverride',
                              null,
                            );
                            reportChange();
                          }}
                          value={field.value ?? ''}
                          className="space-y-2"
                        >
                          {AGGRESSION_OPTIONS.map(
                            (opt) => (
                              <div
                                key={opt.value}
                                className="flex items-center gap-2"
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                />
                                <Label className="flex flex-col">
                                  <span className="font-medium">
                                    {opt.label}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {opt.desc}
                                  </span>
                                </Label>
                              </div>
                            ),
                          )}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Deficit/Surplus Override */}
                <FormField
                  control={form.control}
                  name="deficitOverride"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Custom{' '}
                        {values.goal === 'cutting'
                          ? 'deficit'
                          : 'surplus'}{' '}
                        (kcal/day)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={String(
                            AGGRESSION_PRESETS[
                              (values.aggression ??
                                'moderate') as Aggression
                            ],
                          )}
                          value={
                            field.value ?? ''
                          }
                          onChange={(e) => {
                            const v =
                              e.target.value;
                            field.onChange(
                              v === ''
                                ? null
                                : Number(v),
                            );
                          }}
                          onBlur={() => {
                            field.onBlur();
                            reportChange();
                          }}
                          min={50}
                          max={1500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Live Final Targets */}
            {displayTargets && (
              <div className="rounded-lg border bg-primary/5 p-4">
                <h3 className="mb-3 font-semibold text-base">
                  Your Daily Targets
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="font-bold text-lg">
                      {displayTargets.calories}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      kcal
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      {displayTargets.proteinG}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Protein (g)
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      {displayTargets.carbsG}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Carbs (g)
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      {displayTargets.fatG}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Fat (g)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
