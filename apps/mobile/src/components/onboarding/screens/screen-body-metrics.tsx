import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';
import { AggressionSlider } from '~/components/settings/controls/aggression-slider';
import { CustomSelect } from '~/components/settings/controls/custom-select';
import { DecimalInput } from '~/components/shared/decimal-input';
import { useTranslations } from '~/i18n';
import {
  bodyMetricsMessages,
  bodyMetricsSchema,
  carbSplitSchema,
  createBodyMetricsSchema,
  goalEnumSchema,
} from '~/lib/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '~/lib/onboarding/logic/tdee';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

// Goal block (goal + nullable aggression + carbSplit + transient deficitOverride),
// as a plain object so it merges cleanly; the aggression-required rule is applied
// as a separate superRefine for the gate + resolver.
const goalObjectSchema = z.object({
  goal: goalEnumSchema,
  aggression: z.number().min(0.1).max(0.8).nullable(),
  carbSplit: carbSplitSchema,
  deficitOverride: z.number().min(50).max(1500).nullable(),
});
const screen1ObjectSchema = bodyMetricsSchema.merge(goalObjectSchema);
type Screen1FormData = z.infer<typeof screen1ObjectSchema>;

const aggressionRule = (
  data: { goal: Goal; aggression: number | null },
  ctx: z.RefinementCtx
) => {
  if (data.goal !== 'maintaining' && data.aggression === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['aggression'],
      message: 'Aggression level is required for cutting and bulking goals',
    });
  }
};
const screen1Schema = screen1ObjectSchema.superRefine(aggressionRule);

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

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

/** RN port of web `components/onboarding/screen-body-metrics.tsx` (step 2). */
export function ScreenBodyMetrics({
  defaultValues,
  onChange,
}: ScreenBodyMetricsProps) {
  const t = useTranslations('onboarding.bodyMetrics');
  const tValidation = useTranslations('validation.bodyMetrics');

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const localizedSchema = useMemo(
    () =>
      createBodyMetricsSchema(bodyMetricsMessages(tValidation))
        .merge(goalObjectSchema)
        .superRefine(aggressionRule),
    [tValidation]
  );

  const { control, getValues, setValue } = useForm<Screen1FormData>({
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
  const CARB_SPLIT_INFO: Record<CarbSplit, { label: string; desc: string }> = {
    moderate_carb: { label: t('moderateCarb'), desc: t('moderateCarbDescription') },
    lower_carb: { label: t('lowerCarb'), desc: t('lowerCarbDescription') },
    higher_carb: { label: t('higherCarb'), desc: t('higherCarbDescription') },
  };

  const sex = useWatch({ control, name: 'biologicalSex' });
  const weight = useWatch({ control, name: 'weightKg' });
  const height = useWatch({ control, name: 'heightCm' });
  const age = useWatch({ control, name: 'age' });
  const activity = useWatch({ control, name: 'activityLevel' });
  const goal = useWatch({ control, name: 'goal' });
  const aggression = useWatch({ control, name: 'aggression' });
  const carbSplit = useWatch({ control, name: 'carbSplit' });

  const allMetricsFilled = !!(sex && weight && height && age && activity);

  const tdee = useMemo(() => {
    if (!allMetricsFilled) return null;
    const bmr = calcBMR({
      biologicalSex: sex,
      weightKg: weight,
      heightCm: height,
      age,
      activityLevel: activity as ActivityLevel,
    });
    return calcTDEE(bmr, activity as ActivityLevel);
  }, [sex, weight, height, age, activity, allMetricsFilled]);

  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(tdee, goal, aggression, carbSplit);
  }, [tdee, goal, aggression, carbSplit]);

  const targetCalories = finalTargets?.calories ?? 0;
  const carbOptions = useMemo(
    () =>
      CARB_SPLITS.map((cs) => ({
        id: cs,
        label: CARB_SPLIT_INFO[cs].label,
        desc: CARB_SPLIT_INFO[cs].desc,
        macros: calcMacroGrams(targetCalories, cs),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetCalories, t]
  );
  const macros = useMemo(
    () => (targetCalories ? calcMacroGrams(targetCalories, carbSplit) : null),
    [targetCalories, carbSplit]
  );

  const reportChange = useCallback(() => {
    const v = getValues();
    if (tdee === null || !finalTargets) return;
    if (!screen1Schema.safeParse(v).success) return;
    onChangeRef.current({
      ...v,
      tdeeKcal: tdee,
      calorieTarget: finalTargets.calories,
      proteinTargetG: finalTargets.proteinG,
      carbsTargetG: finalTargets.carbsG,
      fatTargetG: finalTargets.fatG,
    });
  }, [getValues, tdee, finalTargets]);

  useEffect(() => {
    if (tdee !== null && finalTargets) reportChange();
  }, [tdee, finalTargets, reportChange]);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
      </View>

      <View style={styles.section}>
        {/* Body metrics */}
        <View style={styles.grid}>
          <View style={styles.full}>
            <FieldLabel>{t('biologicalSex')}</FieldLabel>
            <Controller
              control={control}
              name="biologicalSex"
              render={({ field }) => (
                <CustomSelect
                  value={field.value ?? ''}
                  onChange={(v) => {
                    field.onChange(v);
                    reportChange();
                  }}
                  options={[
                    { label: t('male'), value: 'male' },
                    { label: t('female'), value: 'female' },
                  ]}
                />
              )}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.cell}>
              <FieldLabel>{`${t('weight')} (${t('weightUnit')})`}</FieldLabel>
              <Controller
                control={control}
                name="weightKg"
                render={({ field, fieldState }) => (
                  <>
                    <DecimalInput
                      placeholder="65"
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        reportChange();
                      }}
                      onBlur={field.onBlur}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </>
                )}
              />
            </View>
            <View style={styles.cell}>
              <FieldLabel>{`${t('height')} (${t('heightUnit')})`}</FieldLabel>
              <Controller
                control={control}
                name="heightCm"
                render={({ field, fieldState }) => (
                  <>
                    <DecimalInput
                      integer
                      placeholder="170"
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        reportChange();
                      }}
                      onBlur={field.onBlur}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </>
                )}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.cell}>
              <FieldLabel>{t('age')}</FieldLabel>
              <Controller
                control={control}
                name="age"
                render={({ field, fieldState }) => (
                  <>
                    <DecimalInput
                      integer
                      placeholder="25"
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        reportChange();
                      }}
                      onBlur={field.onBlur}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </>
                )}
              />
            </View>
            <View style={styles.cell} />
          </View>

          <View style={styles.full}>
            <FieldLabel>{t('activityLevel')}</FieldLabel>
            <Controller
              control={control}
              name="activityLevel"
              render={({ field }) => (
                <CustomSelect
                  value={field.value ?? ''}
                  onChange={(v) => {
                    field.onChange(v);
                    reportChange();
                  }}
                  options={ACTIVITY_OPTIONS}
                />
              )}
            />
          </View>
        </View>

        {tdee !== null ? (
          <View style={styles.goalBlock}>
            <View>
              <FieldLabel>{t('goal')}</FieldLabel>
              <Controller
                control={control}
                name="goal"
                render={({ field }) => (
                  <View style={styles.goalStrip}>
                    {GOALS.map((g) => {
                      const active = field.value === g;
                      return (
                        <Pressable
                          key={g}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => {
                            field.onChange(g);
                            if (g !== 'maintaining' && !getValues('aggression')) {
                              setValue('aggression', 0.5, { shouldDirty: true });
                            }
                            reportChange();
                          }}
                          style={({ pressed }) => [
                            styles.goalBtn,
                            active && styles.goalBtnActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.goalLabel,
                              active ? styles.goalLabelActive : styles.goalLabelInactive,
                            ]}
                          >
                            {GOAL_LABELS[g]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </View>

            {goal !== 'maintaining' ? (
              <View>
                <FieldLabel>
                  {`${t('aggressionLabel')} (${
                    goal === 'cutting'
                      ? t('aggressionDeficit')
                      : t('aggressionSurplus')
                  })`}
                </FieldLabel>
                <Controller
                  control={control}
                  name="aggression"
                  render={({ field }) => (
                    <AggressionSlider
                      value={field.value}
                      goal={goal === 'cutting' ? 'cutting' : 'bulking'}
                      onChange={(v) => {
                        field.onChange(v);
                        reportChange();
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            <View>
              <FieldLabel>{t('carbSplit')}</FieldLabel>
              <Controller
                control={control}
                name="carbSplit"
                render={({ field }) => (
                  <View style={styles.carbCards}>
                    {carbOptions.map((opt) => {
                      const active = field.value === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => {
                            field.onChange(opt.id);
                            reportChange();
                          }}
                          style={({ pressed }) => [
                            styles.carbCard,
                            active && styles.carbCardActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.carbLabel}>{opt.label}</Text>
                          <Text style={styles.carbDesc}>{opt.desc}</Text>
                          <View style={styles.carbMacros}>
                            <Text style={styles.carbMacro}>{`P ${opt.macros.proteinG}g`}</Text>
                            <Text style={styles.carbMacro}>{`C ${opt.macros.carbsG}g`}</Text>
                            <Text style={styles.carbMacro}>{`F ${opt.macros.fatG}g`}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </View>

            {macros ? (
              <View style={styles.hero}>
                <Text style={styles.heroEyebrow}>{t('calorieTarget')}</Text>
                <Text style={styles.heroNumber}>
                  {Math.round(targetCalories).toLocaleString()}
                  <Text style={styles.heroUnit}>{` ${t('kcal')}`}</Text>
                </Text>
                <Text style={styles.heroCaption}>
                  {`${t('basedOnTdee')} ~${Math.round(tdee).toLocaleString()} ${t('kcal')}`}
                  {goal === 'maintaining'
                    ? ` · ${t('maintenance')}`
                    : ` · ${goal === 'cutting' ? '−' : '+'}${Math.abs(
                        Math.round(tdee) - Math.round(targetCalories)
                      ).toLocaleString()} ${t('perDay')} ${
                        goal === 'cutting'
                          ? t('aggressionDeficit')
                          : t('aggressionSurplus')
                      }`}
                </Text>
                <View style={styles.heroMacros}>
                  {[
                    { label: t('protein'), value: macros.proteinG },
                    { label: t('carbs'), value: macros.carbsG },
                    { label: t('fat'), value: macros.fatG },
                  ].map((m) => (
                    <View key={m.label} style={styles.heroMacroCell}>
                      <Text style={styles.heroMacroLabel}>{m.label}</Text>
                      <Text style={styles.heroMacroValue}>{`${m.value}g`}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  head: { gap: space[1] },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textHelp,
  },
  section: {
    gap: space[8],
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[5],
  },
  grid: { gap: space[4] },
  full: { gap: 6 },
  row: { flexDirection: 'row', gap: space[4] },
  cell: { flex: 1, gap: 6 },
  // Onboarding uses stone (#A8A29E) for the metric labels (web text-[#A8A29E]).
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  error: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.danger },
  goalBlock: {
    gap: space[8],
    borderTopWidth: 1,
    borderColor: colors.inputBorder,
    paddingTop: space[6],
  },
  goalStrip: {
    flexDirection: 'row',
    gap: space[1],
    borderRadius: radii.buttonXl,
    backgroundColor: colors.inputBorder40,
    padding: space[1],
  },
  goalBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.md,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
  goalBtnActive: { backgroundColor: colors.elev },
  pressed: { opacity: 0.85 },
  goalLabel: { fontFamily: fonts.sansMedium, fontSize: 14 },
  goalLabelActive: { color: colors.text },
  goalLabelInactive: { color: colors.textWarm },
  carbCards: { gap: space[3] },
  carbCard: {
    gap: space[1],
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[4],
  },
  carbCardActive: { borderColor: colors.accent, backgroundColor: colors.accent05 },
  carbLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  carbDesc: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textWarm },
  carbMacros: { flexDirection: 'row', gap: space[3], marginTop: space[1] },
  carbMacro: { fontFamily: fonts.sansRegular, fontSize: 11, color: colors.textWarm },
  hero: {
    alignItems: 'center',
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.accent40,
    backgroundColor: colors.accent07,
    padding: space[5],
  },
  heroEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  heroNumber: {
    marginTop: space[1],
    fontFamily: fonts.serifRegular,
    fontSize: 40,
    letterSpacing: -1,
    color: colors.text,
  },
  heroUnit: { fontFamily: fonts.sansRegular, fontSize: 18, color: colors.textWarm },
  heroCaption: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textWarm,
  },
  heroMacros: {
    flexDirection: 'row',
    marginTop: space[5],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderColor: colors.accent20,
    alignSelf: 'stretch',
  },
  heroMacroCell: { flex: 1, alignItems: 'center', gap: 2 },
  heroMacroLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  heroMacroValue: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.text },
});
