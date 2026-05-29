import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';
import { useTranslations } from '~/i18n';
import { AGGRESSION_KCAL_PER_KG } from '~/lib/onboarding/constants';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

interface AggressionSliderProps {
  value: number | null;
  onChange: (value: number) => void;
  goal: 'cutting' | 'bulking';
}

/**
 * RN port of the web aggression `<input type=range>` (body-metrics.tsx). 0.1–0.8
 * step 0.05, with the live `kg/wk · ±kcal/day` readout and low/high end labels.
 */
export function AggressionSlider({ value, onChange, goal }: AggressionSliderProps) {
  const t = useTranslations('onboarding.bodyMetrics');
  const aggressionKg = value ?? 0.5;
  const kcalDelta = Math.round(aggressionKg * AGGRESSION_KCAL_PER_KG);

  return (
    <View style={styles.card}>
      <Text style={styles.readout}>
        {`${aggressionKg.toFixed(2)} ${t('weightUnit')}/wk`}
        <Text style={styles.dot}> · </Text>
        {`${goal === 'cutting' ? '−' : '+'}${kcalDelta} ${t('perDay')}`}
      </Text>
      <Slider
        minimumValue={0.1}
        maximumValue={0.8}
        step={0.05}
        value={aggressionKg}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.inputBorder}
        thumbTintColor={colors.accent}
      />
      <View style={styles.endLabels}>
        <Text style={styles.endLabel}>{t('aggressionLow')}</Text>
        <Text style={styles.endLabel}>{t('aggressionHigh')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[3],
    borderRadius: radii.containerLg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.elev,
    padding: space[4],
  },
  readout: {
    textAlign: 'center',
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  dot: { color: colors.textWarm },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  endLabel: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textWarm },
});
