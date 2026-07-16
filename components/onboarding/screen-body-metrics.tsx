'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import {
  bodyMetricsMessages,
  createBodyMetricsSchema,
  goalSchema,
} from '@/lib/onboarding/schemas';
import { calcBMR, calcDailyTargets, calcTDEE } from '@/lib/onboarding/tdee';
import { AboutYouFields } from './body-metrics/about-you-fields';
import { type Screen1FormData, screen1Schema } from './body-metrics/constants';
import { GoalTuning } from './body-metrics/goal-tuning';

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

export function ScreenBodyMetrics({
  defaultValues,
  onChange,
}: ScreenBodyMetricsProps) {
  const t = useTranslations('onboarding');
  const tValidation = useTranslations('validation.bodyMetrics');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Built with locale-aware messages so validation errors follow the active
  // locale. Shares the shape of the module-level screen1Schema used for types.
  const localizedSchema = useMemo(
    () =>
      createBodyMetricsSchema(bodyMetricsMessages(tValidation)).merge(
        goalSchema
      ),
    [tValidation]
  );

  const form = useForm<Screen1FormData>({
    resolver: zodResolver(localizedSchema),
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

  // Report data upstream on discrete changes
  const reportChange = useCallback(() => {
    const v = form.getValues();
    if (tdee === null || !finalTargets) return;
    // Don't advance the wizard with out-of-range / invalid metrics — the Next
    // button is gated on this screen having reported data.
    if (!screen1Schema.safeParse(v).success) return;
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

  return (
    <Form {...form}>
      <form className="space-y-5 lg:space-y-6">
        <div className="max-w-xl">
          <h2 className="mb-1.5 font-normal font-serif text-2xl text-nham-text tracking-tight">
            {t('bodyMetrics.title')}
          </h2>
          <p className="text-[#8B8682] text-[14px] leading-relaxed">
            {t('bodyMetrics.subtitle')}
          </p>
        </div>

        <div
          className={
            tdee !== null
              ? 'space-y-5 lg:grid lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] lg:items-start lg:gap-5 lg:space-y-0'
              : 'space-y-5'
          }
        >
          <AboutYouFields form={form} reportChange={reportChange} />

          {tdee !== null ? (
            <GoalTuning
              form={form}
              reportChange={reportChange}
              tdee={tdee}
              goal={values.goal}
              targetCalories={targetCalories}
            />
          ) : (
            <div className="rounded-[28px] border border-[#EAE7E0] border-dashed bg-[#FFFCF8] p-5">
              <p className="font-medium text-[14px] text-nham-text">
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
