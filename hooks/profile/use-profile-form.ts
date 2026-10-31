'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useTransition } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSettingsDialog } from '@/hooks/settings/use-settings-dialog';
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
  calcTDEE,
} from '@/lib/domain/onboarding/tdee';
import {
  buildDefaultValues,
  PAGE_FOR_FIELD,
  type ProfileFormValues,
  type ProfileInput,
  profileGoalSchema,
} from '@/lib/domain/settings/profile-form';

export function useProfileForm(profile: ProfileInput) {
  const t = useTranslations('settings');
  const tValidation = useTranslations('validation.bodyMetrics');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const settings = useSettingsDialog();

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

  // The form lives in the app shell for the whole session (the dialog closing
  // keeps unsaved edits), so a profile changed elsewhere arrives as new props
  // instead of a fresh mount. Adopt it, keeping any field the user has edited
  // but not saved.
  useEffect(() => {
    form.reset(defaultValues, { keepDirtyValues: true });
  }, [form, defaultValues]);

  function handleCancel() {
    form.reset(defaultValues);
  }

  function handleInvalid(errors: FieldErrors<ProfileFormValues>) {
    const firstField = Object.keys(errors)[0] as
      | keyof ProfileFormValues
      | undefined;
    if (firstField) settings.show(PAGE_FOR_FIELD[firstField]);
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
    const macros = calcDailyTargets(
      tdee,
      values.goal,
      values.aggression,
      values.carbSplit,
      values.biologicalSex
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
          calorieTarget: macros.calories,
          proteinTargetG: macros.proteinG,
          carbsTargetG: macros.carbsG,
          fatTargetG: macros.fatG,
          countryOfOrigin: values.countryOfOrigin,
          countryOfResidence: values.countryOfResidence,
          preferredLocale: locale,
          oilUsage: values.oilUsage,
          defaultRicePortion: values.defaultRicePortion,
          defaultProteinPortion: values.defaultProteinPortion,
          brothConsumption: values.brothConsumption,
        });
        form.reset(values);
        toast.success(t('saved'));
        // The shell holds the profile the dialog opened with, and the page
        // behind the dialog may show the old target: refetch both.
        router.refresh();
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
