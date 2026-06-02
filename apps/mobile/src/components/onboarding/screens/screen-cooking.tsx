import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { CookingHabits } from '@/lib/onboarding/types';
import { OptionStrip } from '~/components/settings/controls/option-strip';
import { useTranslations } from '~/i18n';
import { NEUTRAL_COOKING_DEFAULTS } from '~/lib/onboarding/data/constants';
import { cookingHabitsSchema } from '~/lib/onboarding/schemas';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';

interface ScreenCookingProps {
  defaultValues: Partial<CookingHabits>;
  onChange: (data: CookingHabits) => void;
}

function allCookingFieldsNull(values: Partial<CookingHabits>): boolean {
  return (
    !values.oilUsage &&
    !values.defaultRicePortion &&
    !values.sugarBraised &&
    !values.defaultProteinPortion &&
    !values.brothConsumption
  );
}

/** RN port of web `components/onboarding/screen-cooking.tsx`. */
export function ScreenCooking({ defaultValues, onChange }: ScreenCookingProps) {
  const t = useTranslations('onboarding.cooking');
  const hasPrePopulated = useRef(false);
  const initial: CookingHabits = allCookingFieldsNull(defaultValues)
    ? NEUTRAL_COOKING_DEFAULTS
    : { ...NEUTRAL_COOKING_DEFAULTS, ...defaultValues };

  const { control, getValues, setValue, trigger } = useForm<CookingHabits>({
    resolver: zodResolver(cookingHabitsSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });

  const report = useCallback(
    () => onChange(getValues()),
    [getValues, onChange]
  );

  // One-time pre-population with neutral defaults (so Next is enabled at once).
  useEffect(() => {
    if (!hasPrePopulated.current && allCookingFieldsNull(defaultValues)) {
      for (const [key, value] of Object.entries(NEUTRAL_COOKING_DEFAULTS)) {
        setValue(key as keyof CookingHabits, value as CookingHabits[keyof CookingHabits]);
      }
      void trigger();
      report();
      hasPrePopulated.current = true;
    }
  }, [defaultValues, setValue, trigger, report]);

  const fields: {
    name: keyof CookingHabits;
    label: string;
    hint?: string;
    options: { value: string; label: string; hint?: string }[];
  }[] = [
    {
      name: 'oilUsage',
      label: t('oilUsage'),
      options: [
        { value: 'minimal', label: t('oilMinimal'), hint: t('oilMinimalHint') },
        { value: 'normal', label: t('oilNormal'), hint: t('oilNormalHint') },
        { value: 'heavy', label: t('oilHeavy'), hint: t('oilHeavyHint') },
      ],
    },
    {
      name: 'defaultRicePortion',
      label: t('ricePortion'),
      options: [
        { value: 'small', label: t('riceSmall'), hint: t('riceSmallHint') },
        { value: 'medium', label: t('riceMedium'), hint: t('riceMediumHint') },
        { value: 'large', label: t('riceLarge'), hint: t('riceLargeHint') },
      ],
    },
    {
      name: 'sugarBraised',
      label: t('sugar'),
      hint: t('sugarHint'),
      options: [
        { value: 'low', label: t('sugarLow') },
        { value: 'medium', label: t('sugarMedium') },
        { value: 'high', label: t('sugarHigh') },
      ],
    },
    {
      name: 'defaultProteinPortion',
      label: t('proteinPortion'),
      options: [
        { value: 'small', label: t('proteinSmall'), hint: t('proteinSmallHint') },
        { value: 'medium', label: t('proteinMedium'), hint: t('proteinMediumHint') },
        { value: 'large', label: t('proteinLarge'), hint: t('proteinLargeHint') },
      ],
    },
    {
      name: 'brothConsumption',
      label: t('broth'),
      options: [
        { value: 'leave_it', label: t('brothLeave'), hint: t('brothLeaveHint') },
        { value: 'some', label: t('brothSome'), hint: t('brothSomeHint') },
        { value: 'finish_it', label: t('brothFinish'), hint: t('brothFinishHint') },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
      </View>

      <View style={styles.cards}>
        {fields.map((f) => (
          <View key={f.name} style={styles.card}>
            <Text style={styles.label}>{f.label}</Text>
            {f.hint ? <Text style={styles.hint}>{f.hint}</Text> : null}
            <Controller
              control={control}
              name={f.name}
              render={({ field }) => (
                <OptionStrip
                  options={f.options}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    report();
                  }}
                />
              )}
            />
          </View>
        ))}
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
    fontSize: 15,
    lineHeight: 24,
    color: colors.textHelp,
  },
  cards: { gap: space[4] },
  card: {
    gap: space[3],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[5],
  },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  hint: {
    marginTop: -space[1],
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textHelp,
  },
});
