'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  calcMacroGrams,
} from '@/lib/onboarding/tdee';
import {
  AGGRESSION_PRESETS,
  SKIP_FALLBACK_DEFAULTS,
} from '@/lib/onboarding/constants';
import { saveProfileSettings } from '@/lib/onboarding/actions';
import type {
  Goal,
  CarbSplit,
  Aggression,
  ActivityLevel,
  RegionalProfile,
  FatTrim,
  OilUsage,
  RicePortion,
  SugarBraised,
} from '@/lib/onboarding/types';

// Merged schema for body metrics + goals
const metricsGoalSchema = bodyMetricsSchema.merge(
  z.object({
    goal: z.enum(['cutting', 'bulking', 'maintaining']),
    aggression: z
      .enum(['gentle', 'moderate', 'aggressive'])
      .nullable(),
    carbSplit: z.enum([
      'moderate_carb',
      'lower_carb',
      'higher_carb',
    ]),
  }),
);

interface ProfileEditorForm {
  // Body metrics
  biologicalSex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  // Goals
  goal: Goal;
  aggression: Aggression | null;
  carbSplit: CarbSplit;
  calorieTarget: number;
  // Regional
  regionalProfile: RegionalProfile;
  // Cooking habits (3 separate fat trim)
  oilUsage: OilUsage;
  fatTrimPork: FatTrim;
  fatTrimChicken: FatTrim;
  fatTrimFish: FatTrim;
  boneAwareness: boolean;
  defaultRicePortion: RicePortion;
  sugarBraised: SugarBraised;
  // Portions
  handSpanCm: number | null;
  knuckleDepthCm: number | null;
  bowlSizeMl: number;
  plateSizeMl: number;
}

interface ProfileEditorProps {
  profile: {
    weightKg: string | null;
    heightCm: number | null;
    age: number | null;
    biologicalSex: string | null;
    activityLevel: string | null;
    tdeeKcal: number | null;
    goal: string | null;
    aggression: string | null;
    carbSplit: string | null;
    calorieTarget: number | null;
    proteinTargetG: number | null;
    carbsTargetG: number | null;
    fatTargetG: number | null;
    regionalProfile: string | null;
    oilUsage: string | null;
    fatTrimPork: string | null;
    fatTrimChicken: string | null;
    fatTrimFish: string | null;
    boneAwareness: boolean | null;
    defaultRicePortion: string | null;
    sugarBraised: string | null;
    handSpanCm: string | null;
    knuckleDepthCm: string | null;
    bowlSizeMl: number | null;
    plateSizeMl: number | null;
  };
}

const REGION_OPTIONS: {
  value: RegionalProfile;
  label: string;
}[] = [
  { value: 'mien_bac', label: 'Miền Bắc' },
  { value: 'mien_trung', label: 'Miền Trung' },
  { value: 'mien_nam', label: 'Miền Nam' },
  { value: 'mien_tay', label: 'Miền Tây' },
];

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileEditorForm>({
    resolver: zodResolver(metricsGoalSchema) as any,
    defaultValues: {
      biologicalSex:
        (profile.biologicalSex as 'male' | 'female') ??
        'male',
      weightKg: profile.weightKg
        ? Number(profile.weightKg)
        : 65,
      heightCm: profile.heightCm ?? 165,
      age: profile.age ?? 25,
      activityLevel:
        (profile.activityLevel as ActivityLevel) ?? 'light',
      goal: (profile.goal as Goal) ?? 'maintaining',
      aggression:
        (profile.aggression as Aggression) ?? null,
      carbSplit:
        (profile.carbSplit as CarbSplit) ?? 'moderate_carb',
      calorieTarget: profile.calorieTarget ?? 2000,
      regionalProfile:
        (profile.regionalProfile as RegionalProfile) ??
        'mien_bac',
      oilUsage:
        (profile.oilUsage as OilUsage) ?? 'normal',
      fatTrimPork:
        (profile.fatTrimPork as FatTrim) ?? 'eat_all',
      fatTrimChicken:
        (profile.fatTrimChicken as FatTrim) ?? 'eat_all',
      fatTrimFish:
        (profile.fatTrimFish as FatTrim) ?? 'eat_all',
      boneAwareness: profile.boneAwareness ?? false,
      defaultRicePortion:
        (profile.defaultRicePortion as RicePortion) ??
        'medium',
      sugarBraised:
        (profile.sugarBraised as SugarBraised) ?? 'medium',
      handSpanCm: profile.handSpanCm
        ? Number(profile.handSpanCm)
        : null,
      knuckleDepthCm: profile.knuckleDepthCm
        ? Number(profile.knuckleDepthCm)
        : null,
      bowlSizeMl:
        profile.bowlSizeMl ??
        SKIP_FALLBACK_DEFAULTS.bowlSizeMl,
      plateSizeMl:
        profile.plateSizeMl ??
        SKIP_FALLBACK_DEFAULTS.plateSizeMl,
    },
    mode: 'onBlur',
  });

  const watchSex = form.watch('biologicalSex');
  const watchWeight = form.watch('weightKg');
  const watchHeight = form.watch('heightCm');
  const watchAge = form.watch('age');
  const watchActivity = form.watch('activityLevel');
  const watchGoal = form.watch('goal');
  const watchAggression = form.watch('aggression');
  const watchCarbSplit = form.watch('carbSplit');
  const watchCalorieTarget = form.watch('calorieTarget');

  // Live TDEE calculation
  const tdee = useMemo(() => {
    if (!watchWeight || !watchHeight || !watchAge || !watchSex)
      return null;
    const bmr = calcBMR({
      biologicalSex: watchSex,
      weightKg: watchWeight,
      heightCm: watchHeight,
      age: watchAge,
      activityLevel: watchActivity,
    });
    return calcTDEE(bmr, watchActivity);
  }, [
    watchSex,
    watchWeight,
    watchHeight,
    watchAge,
    watchActivity,
  ]);

  // When goal/aggression/carbSplit changes → overwrite calorieTarget from TDEE
  const recomputeFromTDEE = useCallback(
    (
      newGoal?: Goal,
      newAggression?: Aggression | null,
      newCarbSplit?: CarbSplit,
    ) => {
      if (!tdee) return;
      const g = newGoal ?? form.getValues('goal');
      const a = newAggression !== undefined
        ? newAggression
        : form.getValues('aggression');
      const cs =
        newCarbSplit ?? form.getValues('carbSplit');
      const targets = calcDailyTargets(tdee, g, a, cs);
      const clamped = Math.max(targets.calories, 500);
      form.setValue('calorieTarget', clamped);
    },
    [tdee, form],
  );

  // Compute macros from current calorieTarget + carbSplit
  const macros = useMemo(() => {
    if (!watchCalorieTarget) return null;
    return calcMacroGrams(watchCalorieTarget, watchCarbSplit);
  }, [watchCalorieTarget, watchCarbSplit]);

  async function handleSave() {
    // Compute final macros from current values
    const values = form.getValues();
    const finalMacros = calcMacroGrams(
      values.calorieTarget,
      values.carbSplit,
    );

    startTransition(async () => {
      try {
        await saveProfileSettings({
          weightKg: values.weightKg,
          heightCm: values.heightCm,
          age: values.age,
          biologicalSex: values.biologicalSex,
          activityLevel: values.activityLevel,
          tdeeKcal: tdee,
          goal: values.goal,
          aggression: values.aggression,
          carbSplit: values.carbSplit,
          calorieTarget: values.calorieTarget,
          proteinTargetG: finalMacros.proteinG,
          carbsTargetG: finalMacros.carbsG,
          fatTargetG: finalMacros.fatG,
          regionalProfile: values.regionalProfile,
          oilUsage: values.oilUsage,
          fatTrimPork: values.fatTrimPork,
          fatTrimChicken: values.fatTrimChicken,
          fatTrimFish: values.fatTrimFish,
          boneAwareness: values.boneAwareness,
          defaultRicePortion: values.defaultRicePortion,
          sugarBraised: values.sugarBraised,
          handSpanCm: values.handSpanCm,
          knuckleDepthCm: values.knuckleDepthCm,
          bowlSizeMl: values.bowlSizeMl,
          plateSizeMl: values.plateSizeMl,
        });
        toast.success('Đã lưu cài đặt hồ sơ');
      } catch {
        toast.error('Không thể lưu cài đặt. Vui lòng thử lại.');
      }
    });
  }

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        {/* ─── Body Metrics & Goals ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Chỉ số cơ thể & Mục tiêu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sex */}
            <FormField
              control={form.control}
              name="biologicalSex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giới tính sinh học</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="male"
                          id="sex-male"
                        />
                        <Label htmlFor="sex-male">
                          Nam
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value="female"
                          id="sex-female"
                        />
                        <Label htmlFor="sex-female">
                          Nữ
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Weight / Height / Age */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cân nặng (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min={30}
                        max={300}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chiều cao (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={100}
                        max={250}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tuổi</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={13}
                        max={100}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Activity Level */}
            <FormField
              control={form.control}
              name="activityLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mức vận động</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sedentary">
                        Ít vận động
                      </SelectItem>
                      <SelectItem value="light">
                        Nhẹ
                      </SelectItem>
                      <SelectItem value="moderate">
                        Trung bình
                      </SelectItem>
                      <SelectItem value="very_active">
                        Năng động
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* TDEE display */}
            {tdee && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-medium">TDEE: </span>
                <span>{tdee} kcal/ngày</span>
              </div>
            )}

            {/* Goal */}
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mục tiêu</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => {
                        if (v) {
                          const newGoal = v as Goal;
                          field.onChange(newGoal);
                          if (
                            newGoal !== 'maintaining' &&
                            !form.getValues('aggression')
                          ) {
                            form.setValue(
                              'aggression',
                              'moderate',
                            );
                            recomputeFromTDEE(
                              newGoal,
                              'moderate',
                            );
                          } else {
                            recomputeFromTDEE(newGoal);
                          }
                        }
                      }}
                    >
                      <ToggleGroupItem value="cutting">
                        Giảm cân
                      </ToggleGroupItem>
                      <ToggleGroupItem value="maintaining">
                        Giữ cân
                      </ToggleGroupItem>
                      <ToggleGroupItem value="bulking">
                        Tăng cân
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Aggression — visible for cutting/bulking */}
            {watchGoal !== 'maintaining' && (
              <FormField
                control={form.control}
                name="aggression"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tốc độ</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value ?? ''}
                        onValueChange={(v) => {
                          if (v) {
                            const newAgg =
                              v as Aggression;
                            field.onChange(newAgg);
                            recomputeFromTDEE(
                              undefined,
                              newAgg,
                            );
                          }
                        }}
                      >
                        <ToggleGroupItem value="gentle">
                          Nhẹ nhàng (~
                          {AGGRESSION_PRESETS.gentle}{' '}
                          kcal)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="moderate">
                          Vừa phải (~
                          {AGGRESSION_PRESETS.moderate}{' '}
                          kcal)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="aggressive">
                          Nhanh (~
                          {AGGRESSION_PRESETS.aggressive}{' '}
                          kcal)
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Carb Split */}
            <FormField
              control={form.control}
              name="carbSplit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tỉ lệ carb</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => {
                        if (v) {
                          const newCS = v as CarbSplit;
                          field.onChange(newCS);
                          recomputeFromTDEE(
                            undefined,
                            undefined,
                            newCS,
                          );
                        }
                      }}
                    >
                      <ToggleGroupItem value="moderate_carb">
                        Cân bằng
                      </ToggleGroupItem>
                      <ToggleGroupItem value="lower_carb">
                        Ít carb
                      </ToggleGroupItem>
                      <ToggleGroupItem value="higher_carb">
                        Nhiều carb
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Calorie Target — editable fine-tuning */}
            <FormField
              control={form.control}
              name="calorieTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Mục tiêu calo (kcal/ngày)
                  </FormLabel>
                  <p className="text-muted-foreground text-xs">
                    Chỉnh tay để tinh chỉnh. Đổi mục
                    tiêu/tốc độ/carb sẽ tính lại từ TDEE.
                  </p>
                  <FormControl>
                    <Input
                      type="number"
                      min={500}
                      max={10000}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          Number(e.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live macro display */}
            {macros && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-center text-sm">
                <div>
                  <div className="font-medium">
                    Protein
                  </div>
                  <div>{macros.proteinG}g</div>
                </div>
                <div>
                  <div className="font-medium">Carbs</div>
                  <div>{macros.carbsG}g</div>
                </div>
                <div>
                  <div className="font-medium">Fat</div>
                  <div>{macros.fatG}g</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Regional Profile ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Vùng miền ẩm thực</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="regionalProfile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vùng miền</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REGION_OPTIONS.map((r) => (
                        <SelectItem
                          key={r.value}
                          value={r.value}
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ─── Cooking Habits (3 separate fat-trim) ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Thói quen nấu ăn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Oil Usage */}
            <FormField
              control={form.control}
              name="oilUsage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel>
                      Mức dầu mỡ khi nấu
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) field.onChange(v);
                        }}
                      >
                        <ToggleGroupItem value="minimal">
                          Ít dầu
                        </ToggleGroupItem>
                        <ToggleGroupItem value="normal">
                          Bình thường
                        </ToggleGroupItem>
                        <ToggleGroupItem value="heavy">
                          Nhiều dầu
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {/* Fat Trim — 3 separate controls */}
            <div className="space-y-4">
              <Label className="font-medium text-sm">
                Xử lý mỡ theo loại thịt
              </Label>

              {/* Pork fat */}
              <FormField
                control={form.control}
                name="fatTrimPork"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <FormLabel className="text-sm">
                        Mỡ heo
                      </FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={field.value}
                          onValueChange={(v) => {
                            if (v) field.onChange(v);
                          }}
                        >
                          <ToggleGroupItem value="trim">
                            Bỏ mỡ
                          </ToggleGroupItem>
                          <ToggleGroupItem value="eat_all">
                            Ăn nguyên
                          </ToggleGroupItem>
                          <ToggleGroupItem value="by_dish">
                            Tùy món
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* Chicken skin */}
              <FormField
                control={form.control}
                name="fatTrimChicken"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <FormLabel className="text-sm">
                        Da gà
                      </FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={field.value}
                          onValueChange={(v) => {
                            if (v) field.onChange(v);
                          }}
                        >
                          <ToggleGroupItem value="trim">
                            Bỏ da
                          </ToggleGroupItem>
                          <ToggleGroupItem value="eat_all">
                            Ăn nguyên
                          </ToggleGroupItem>
                          <ToggleGroupItem value="by_dish">
                            Tùy món
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* Fish fat */}
              <FormField
                control={form.control}
                name="fatTrimFish"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <FormLabel className="text-sm">
                        Mỡ cá
                      </FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={field.value}
                          onValueChange={(v) => {
                            if (v) field.onChange(v);
                          }}
                        >
                          <ToggleGroupItem value="trim">
                            Bỏ mỡ
                          </ToggleGroupItem>
                          <ToggleGroupItem value="eat_all">
                            Ăn nguyên
                          </ToggleGroupItem>
                          <ToggleGroupItem value="by_dish">
                            Tùy món
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Bone Awareness */}
            <FormField
              control={form.control}
              name="boneAwareness"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="font-medium text-sm">
                      Cân nhắc xương khi ước lượng phần ăn
                    </Label>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {/* Rice Portion */}
            <FormField
              control={form.control}
              name="defaultRicePortion"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel>
                      Khẩu phần cơm mặc định
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) field.onChange(v);
                        }}
                      >
                        <ToggleGroupItem value="small">
                          Nhỏ ~150g
                        </ToggleGroupItem>
                        <ToggleGroupItem value="medium">
                          Vừa ~200g
                        </ToggleGroupItem>
                        <ToggleGroupItem value="large">
                          Lớn ~300g
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {/* Sugar Braised */}
            <FormField
              control={form.control}
              name="sugarBraised"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel>
                      Mức đường trong món kho
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) field.onChange(v);
                        }}
                      >
                        <ToggleGroupItem value="low">
                          Ít
                        </ToggleGroupItem>
                        <ToggleGroupItem value="medium">
                          Vừa
                        </ToggleGroupItem>
                        <ToggleGroupItem value="high">
                          Nhiều
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ─── Portion Calibration ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Hiệu chỉnh phần ăn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="font-medium text-sm">
                Đo bàn tay
              </Label>
              <p className="text-muted-foreground text-xs">
                Bỏ trống để dùng giá trị mặc định (sải tay
                20cm, đốt ngón 2.5cm)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="handSpanCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sải tay (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          min={10}
                          max={35}
                          placeholder="20"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === ''
                                ? null
                                : Number(e.target.value);
                            field.onChange(val);
                          }}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="knuckleDepthCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Đốt ngón (cm)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min={1}
                          max={5}
                          placeholder="2.5"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === ''
                                ? null
                                : Number(e.target.value);
                            field.onChange(val);
                          }}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-medium text-sm">
                Kích thước bát đĩa
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bowlSizeMl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bát (ml)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={50}
                          max={1000}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plateSizeMl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Đĩa (ml)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={100}
                          max={2000}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Save Button ─── */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
