import { Controller, useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { OptionStrip } from '~/components/settings/controls/option-strip';
import type { ProfileFormValues } from '~/components/settings/profile';

type CookingFieldName =
  | 'oilUsage'
  | 'defaultRicePortion'
  | 'sugarBraised'
  | 'defaultProteinPortion'
  | 'brothConsumption';

/** RN port of web `components/settings/profile/cooking.tsx`. */
export function Cooking() {
  const t = useTranslations('onboarding.cooking');
  const { control } = useFormContext<ProfileFormValues>();

  const fields: {
    name: CookingFieldName;
    label: string;
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
      {fields.map((f) => (
        <View key={f.name} style={styles.card}>
          <Text style={styles.label}>{f.label}</Text>
          <Controller
            control={control}
            name={f.name}
            render={({ field }) => (
              <OptionStrip
                options={f.options}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  card: {
    gap: space[3],
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[4],
  },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
});
