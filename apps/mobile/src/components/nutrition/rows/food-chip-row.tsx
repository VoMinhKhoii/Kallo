import { StyleSheet, View } from 'react-native';
import type { NutritionNutrientKey } from '@/lib/nutrition/types';
import { useTranslations } from '~/i18n';
import { useFoodCandidates } from '~/lib/nutrition/hooks/use-food-candidates';
import { asSupported } from '~/lib/nutrition/logic/candidate-nutrients';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

interface FoodChipRowProps {
  nutrient: NutritionNutrientKey;
  enabled?: boolean;
  /** Adjusts visual treatment between spotlight (warmer) and steady contexts. */
  variant?: 'spotlight' | 'steady';
  /** Maximum chips to render. */
  limit?: number;
}

/** RN port of web `components/nutrition/rows/food-chip-row.tsx`. */
export function FoodChipRow({
  nutrient,
  enabled = true,
  variant = 'spotlight',
  limit = 5,
}: FoodChipRowProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const supported = asSupported(nutrient);
  const query = useFoodCandidates(nutrient, enabled);

  if (!supported) return null;

  if (query.isLoading) {
    return <ChipRowSkeleton variant={variant} />;
  }

  if (query.isError) {
    return <Text style={styles.muted}>{t('errors.candidatesError')}</Text>;
  }

  if (query.isSuccess && !query.data.candidates.length) {
    return <Text style={styles.muted}>{t('focus.noFoodIdeas')}</Text>;
  }

  if (!query.data?.candidates.length) {
    return null;
  }

  const chips = query.data.candidates.slice(0, limit);

  return (
    <View style={styles.row}>
      <Text style={styles.tryLabel}>{t('focus.tryLabel')}</Text>
      {chips.map((candidate) => (
        <View
          key={candidate.id}
          style={[
            styles.chip,
            variant === 'spotlight' ? styles.chipSpotlight : styles.chipSteady,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              variant === 'steady' && styles.chipTextSteady,
            ]}
          >
            {tRoot(candidate.nameKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ChipRowSkeleton({ variant }: { variant: 'spotlight' | 'steady' }) {
  return (
    <View style={styles.skeletonRow}>
      {[60, 80, 70, 90].map((width) => (
        <View
          key={width}
          style={[
            styles.skeletonChip,
            { width },
            variant === 'spotlight'
              ? { backgroundColor: colors.accent15 }
              : { backgroundColor: colors.track },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  tryLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    // Web tracking-[0.2em] @ 10px = 2.
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  chipSpotlight: {
    borderColor: colors.accent40,
    backgroundColor: colors.accent10,
  },
  chipSteady: {
    borderColor: colors.borderSoft,
    backgroundColor: 'transparent',
  },
  chipText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    lineHeight: 20,
    color: colors.text,
  },
  chipTextSteady: { color: colors.textMuted },
  muted: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
  },
  skeletonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  skeletonChip: { height: 28, borderRadius: radii.pill },
});
