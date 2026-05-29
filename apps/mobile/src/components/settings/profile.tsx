import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { type FieldErrors, FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  ReduceMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import type { ProfileSettingsInput } from '@/lib/api/contracts/onboarding';
import type {
  ActivityLevel,
  BrothConsumption,
  CarbSplit,
  Goal,
  OilUsage,
  ProteinPortion,
  RicePortion,
  SugarBraised,
} from '@/lib/onboarding/types';
import { useLocale, useTranslations } from '~/i18n';
import {
  bodyMetricsMessages,
  cookingHabitsSchema,
  countrySchema,
  createBodyMetricsSchema,
} from '~/lib/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '~/lib/onboarding/tdee';
import type { ProfileRow } from '~/lib/onboarding/use-profile';
import { useSaveProfile } from '~/lib/onboarding/use-save-profile';
import { Text } from '~/theme/text';
import { colors, fonts, radii, shadow, space } from '~/theme/tokens';
import { BodyMetrics } from './body-metrics';
import { Cooking } from './cooking';
import { Regional } from './regional';
import { TabStrip } from './tab-strip';

// Local goal schema — mirrors the web settings form: goal + nullable aggression
// + carbSplit, NO deficitOverride, NO superRefine (deliberate 1:1 contract).
const profileGoalSchema = z.object({
  goal: z.enum(['cutting', 'bulking', 'maintaining']),
  aggression: z.number().min(0.1).max(0.8).nullable(),
  carbSplit: z.enum(['moderate_carb', 'lower_carb', 'higher_carb']),
});

export type ProfileFormValues = z.infer<
  ReturnType<typeof createBodyMetricsSchema>
> &
  z.infer<typeof profileGoalSchema> &
  z.infer<typeof countrySchema> &
  z.infer<typeof cookingHabitsSchema>;

type SectionId = 'body-metrics' | 'regional' | 'cooking';

// Which tab owns each field, so an invalid submit switches to the tab holding
// the first error instead of failing silently behind another tab.
const SECTION_FOR_FIELD: Partial<Record<keyof ProfileFormValues, SectionId>> = {
  biologicalSex: 'body-metrics',
  weightKg: 'body-metrics',
  heightCm: 'body-metrics',
  age: 'body-metrics',
  activityLevel: 'body-metrics',
  goal: 'body-metrics',
  aggression: 'body-metrics',
  carbSplit: 'body-metrics',
  countryOfOrigin: 'regional',
  countryOfResidence: 'regional',
  oilUsage: 'cooking',
  defaultRicePortion: 'cooking',
  sugarBraised: 'cooking',
  defaultProteinPortion: 'cooking',
  brothConsumption: 'cooking',
};

/** RN port of web `components/settings/profile/index.tsx`. */
export function Profile({ profile }: { profile: ProfileRow }) {
  const t = useTranslations('settings');
  const tPage = useTranslations('settings.profilePage');
  const tc = useTranslations('common');
  const tValidation = useTranslations('validation.bodyMetrics');
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SectionId>('body-metrics');
  const [errorText, setErrorText] = useState<string | null>(null);
  const saveProfile = useSaveProfile();

  const SECTIONS: { id: SectionId; title: string; subtitle: string }[] = [
    {
      id: 'body-metrics',
      title: t('bodyMetrics'),
      subtitle: t('profilePanel.bodyMetricsSubtitle'),
    },
    {
      id: 'regional',
      title: t('regional'),
      subtitle: t('profilePanel.regionalSubtitle'),
    },
    {
      id: 'cooking',
      title: t('cooking'),
      subtitle: t('profilePanel.cookingSubtitle'),
    },
  ];

  const defaultValues: ProfileFormValues = useMemo(
    () => ({
      biologicalSex: (profile.biologicalSex as 'male' | 'female') ?? 'male',
      weightKg: profile.weightKg ? Number(profile.weightKg) : 65,
      heightCm: profile.heightCm ?? 165,
      age: profile.age ?? 25,
      activityLevel: (profile.activityLevel as ActivityLevel) ?? 'light',
      goal: (profile.goal as Goal) ?? 'maintaining',
      aggression: (() => {
        const raw = profile.aggression;
        if (!raw) return null;
        const n = Number(raw);
        return Number.isNaN(n) ? 0.5 : n;
      })(),
      carbSplit: (profile.carbSplit as CarbSplit) ?? 'moderate_carb',
      countryOfOrigin: profile.countryOfOrigin ?? null,
      countryOfResidence: profile.countryOfResidence ?? null,
      oilUsage: (profile.oilUsage as OilUsage) ?? 'normal',
      defaultRicePortion: (profile.defaultRicePortion as RicePortion) ?? 'medium',
      sugarBraised: (profile.sugarBraised as SugarBraised) ?? 'medium',
      defaultProteinPortion:
        (profile.defaultProteinPortion as ProteinPortion) ?? 'medium',
      brothConsumption: (profile.brothConsumption as BrothConsumption) ?? 'some',
    }),
    [profile]
  );

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
  const isDirty = form.formState.isDirty;

  function handleCancel() {
    form.reset(defaultValues);
    setErrorText(null);
  }

  function handleInvalid(errors: FieldErrors<ProfileFormValues>) {
    const firstField = Object.keys(errors)[0] as
      | keyof ProfileFormValues
      | undefined;
    const section = firstField ? SECTION_FOR_FIELD[firstField] : undefined;
    if (section) setActiveTab(section);
    setErrorText(t('profilePanel.invalidError'));
  }

  function handleSave(values: ProfileFormValues) {
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
    const macros = calcMacroGrams(Math.max(targets.calories, 500), values.carbSplit);

    const payload: ProfileSettingsInput = {
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
    };

    setErrorText(null);
    saveProfile.mutate(payload, {
      onSuccess: () => form.reset(values),
      onError: () => setErrorText(t('profilePanel.saveError')),
    });
  }

  const activeSubtitle =
    SECTIONS.find((s) => s.id === activeTab)?.subtitle ?? '';

  return (
    <FormProvider {...form}>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>{tPage('title')}</Text>
          <Text style={styles.pageDesc}>{tPage('description')}</Text>

          <TabStrip
            tabs={SECTIONS.map((s) => ({ id: s.id, label: s.title }))}
            active={activeTab}
            onChange={(id) => setActiveTab(id as SectionId)}
          />

          <View style={styles.panel}>
            <Text style={styles.subtitle}>{activeSubtitle}</Text>
            {activeTab === 'body-metrics' ? (
              <BodyMetrics />
            ) : activeTab === 'regional' ? (
              <Regional />
            ) : (
              <Cooking />
            )}
          </View>
        </ScrollView>

        {isDirty ? (
          // Mirrors web's AnimatePresence: slides up 20px + fades in on dirty,
          // slides/fades back down on cancel/save (exit fires because the
          // Animated.View is conditionally mounted). 0.2s ease-out → 200ms.
          <Animated.View
            entering={FadeInDown.duration(200)
              .easing(Easing.out(Easing.ease))
              .reduceMotion(ReduceMotion.System)}
            exiting={FadeOutDown.duration(200).reduceMotion(ReduceMotion.System)}
            style={[styles.saveBar, { paddingBottom: insets.bottom + space[2] }]}
          >
            {errorText ? <Text style={styles.saveError}>{errorText}</Text> : null}
            <View style={styles.saveRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCancel}
                disabled={saveProfile.isPending}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.cancelPressed,
                ]}
              >
                <Text style={styles.cancelLabel}>{tc('cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={form.handleSubmit(handleSave, handleInvalid)}
                disabled={saveProfile.isPending}
                style={[styles.saveBtn, saveProfile.isPending && styles.saveBtnDisabled]}
              >
                {saveProfile.isPending ? (
                  <ActivityIndicator size="small" color={colors.cream} />
                ) : (
                  <Text style={styles.saveLabel}>{t('save')}</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[16],
  },
  pageTitle: {
    fontFamily: fonts.serifRegular,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  pageDesc: {
    marginTop: space[1],
    marginBottom: space[4],
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textWarm,
  },
  panel: {
    marginTop: space[2],
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cream,
    padding: space[3],
  },
  subtitle: {
    marginBottom: space[5],
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textWarm,
  },
  saveBar: {
    borderTopWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cream95,
    paddingHorizontal: space[5],
    paddingTop: 14,
    ...shadow.md,
  },
  saveError: {
    marginBottom: space[2],
    textAlign: 'right',
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.danger,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[3],
  },
  cancelBtn: {
    borderRadius: radii.xl,
    paddingHorizontal: space[5],
    paddingVertical: 10,
  },
  cancelPressed: { backgroundColor: colors.track },
  cancelLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textWarm },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radii.xl,
    backgroundColor: colors.text,
    paddingHorizontal: space[5],
    paddingVertical: 10,
    minWidth: 88,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.cream },
});
