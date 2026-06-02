import { useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '~/lib/onboarding/logic/tdee';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { DecimalInput } from '~/components/shared/decimal-input';
import { AggressionSlider } from '../controls/aggression-slider';
import { CustomSelect } from '../controls/custom-select';
import type { ProfileFormValues } from '../profile';

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function BodyMetrics() {
  const t = useTranslations('onboarding.bodyMetrics');
  const { control, getValues, setValue } = useFormContext<ProfileFormValues>();

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

  const watchSex = useWatch({ control, name: 'biologicalSex' });
  const watchWeight = useWatch({ control, name: 'weightKg' });
  const watchHeight = useWatch({ control, name: 'heightCm' });
  const watchAge = useWatch({ control, name: 'age' });
  const watchActivity = useWatch({ control, name: 'activityLevel' });
  const watchGoal = useWatch({ control, name: 'goal' });
  const watchAggression = useWatch({ control, name: 'aggression' });
  const watchCarbSplit = useWatch({ control, name: 'carbSplit' });

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
  }, [watchSex, watchWeight, watchHeight, watchAge, watchActivity, allMetricsFilled]);

  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(tdee, watchGoal, watchAggression, watchCarbSplit);
  }, [tdee, watchGoal, watchAggression, watchCarbSplit]);

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

  const macros = useMemo(() => {
    if (!targetCalories) return null;
    return calcMacroGrams(targetCalories, watchCarbSplit);
  }, [targetCalories, watchCarbSplit]);

  return (
    <View style={styles.root}>
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
                onChange={field.onChange}
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
                    onValueChange={field.onChange}
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
                    onValueChange={field.onChange}
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
                    onValueChange={field.onChange}
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
                onChange={field.onChange}
                options={ACTIVITY_OPTIONS}
              />
            )}
          />
        </View>
      </View>

      {/* Goal → pace → split → target (only once metrics produce a TDEE) */}
      {tdee !== null ? (
        <View style={styles.goalBlock}>
          {/* Goal */}
          <View style={styles.labelGroup}>
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

          {/* Aggression */}
          {watchGoal !== 'maintaining' ? (
            <View style={styles.labelGroup}>
              <FieldLabel>
                {`${t('aggressionLabel')} (${
                  watchGoal === 'cutting'
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
                    onChange={field.onChange}
                    goal={watchGoal === 'cutting' ? 'cutting' : 'bulking'}
                  />
                )}
              />
            </View>
          ) : null}

          {/* Carb split */}
          <View style={styles.labelGroup}>
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
                        onPress={() => field.onChange(opt.id)}
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

          {/* Hero target card */}
          {macros ? (
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>{t('calorieTarget')}</Text>
              <Text style={styles.heroNumber}>
                {Math.round(targetCalories).toLocaleString()}
                <Text style={styles.heroUnit}>{` ${t('kcal')}`}</Text>
              </Text>
              <Text style={styles.heroCaption}>
                {`${t('basedOnTdee')} ~${Math.round(tdee).toLocaleString()} ${t('kcal')}`}
                {watchGoal === 'maintaining'
                  ? ` · ${t('maintenance')}`
                  : ` · ${watchGoal === 'cutting' ? '−' : '+'}${Math.abs(
                      Math.round(tdee) - Math.round(targetCalories)
                    ).toLocaleString()} ${t('perDay')} ${
                      watchGoal === 'cutting'
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
  );
}

const styles = StyleSheet.create({
  root: { gap: space[8] },
  grid: { gap: space[4] },
  // Goal/aggression/carb labels sit 8px above their control (web `mb-2`),
  // unlike the metrics fields which use the 6px container gap (web `mb-1.5`).
  labelGroup: { gap: space[2] },
  pressed: { opacity: 0.85 },
  full: { gap: 6 },
  row: { flexDirection: 'row', gap: space[4] },
  cell: { flex: 1, gap: 6 },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSoft,
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
  carbMacros: { flexDirection: 'row', gap: space[3] },
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
    fontSize: 36,
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
