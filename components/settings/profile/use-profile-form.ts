'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useTransition } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { SUBSECTION_ANCHOR } from '@/components/settings/anchors';
import { saveProfileSettings } from '@/lib/domain/onboarding/actions';
import {
  bodyMetricsMessages,
  cookingHabitsSchema,
  countrySchema,
  createBodyMetricsSchema,
} from '@/lib/domain/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/domain/onboarding/tdee';
import {
  buildDefaultValues,
  type ProfileFormValues,
  type ProfileInput,
  profileGoalSchema,
  SECTION_FOR_FIELD,
} from './form-schema';

export function useProfileForm(profile: ProfileInput) {
  const t = useTranslations('settings');
  const tValidation = useTranslations('validation.bodyMetrics');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(() => buildDefaultValues(profile), [profile]);

  // Built with locale-aware messages so validation errors follow the active
  // locale. Shares the shape of the type-level ProfileFormValues.
  const localizedProfileSchema = useMemo(
    () =>
      createBodyMetricsSchema(bodyMetricsMessages(tValidation))
        .merge(profileGoalSchema)
        .merge(countrySchema)
        .merge(cookingHabitsSchema),
    [tValidation]
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(localizedProfileSchema),
    defaultValues,
    mode: 'onBlur',
  });

  function handleCancel() {
    form.reset(defaultValues);
  }

  function handleInvalid(errors: FieldErrors<ProfileFormValues>) {
    const firstField = Object.keys(errors)[0] as
      | keyof ProfileFormValues
      | undefined;
    const section = firstField ? SECTION_FOR_FIELD[firstField] : undefined;
    if (section) {
      document
        .getElementById(SUBSECTION_ANCHOR[section])
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast.error(t('profilePanel.invalidError'));
  }

  function handleSave(values: ProfileFormValues) {
    // Compute TDEE and macros for persistence
    const bmr = calcBMR({
      biologicalSex: values.biologicalSex,
      weightKg: values.weightKg,
      heightCm: values.heightCm,
      age: values.age,
      activityLevel: values.activityLevel,
    });
    const tdee = calcTDEE(bmr, values.activityLevel);
    const targets = calcDailyTargets(
      tdee,
      values.goal,
      values.aggression,
      values.carbSplit
    );
    const macros = calcMacroGrams(
      Math.max(targets.calories, 500),
      values.carbSplit
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
          calorieTarget: Math.max(targets.calories, 500),
          proteinTargetG: macros.proteinG,
          carbsTargetG: macros.carbsG,
          fatTargetG: macros.fatG,
          countryOfOrigin: values.countryOfOrigin,
          countryOfResidence: values.countryOfResidence,
          preferredLocale: locale,
          oilUsage: values.oilUsage,
          defaultRicePortion: values.defaultRicePortion,
          sugarBraised: values.sugarBraised,
          defaultProteinPortion: values.defaultProteinPortion,
          brothConsumption: values.brothConsumption,
        });
        form.reset(values);
        toast.success(t('saved'));
      } catch {
        toast.error(t('profilePanel.saveError'));
      }
    });
  }

  return {
    form,
    isPending,
    onSubmit: form.handleSubmit(handleSave, handleInvalid),
    handleCancel,
  };
}
