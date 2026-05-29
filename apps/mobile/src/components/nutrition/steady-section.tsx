import { StyleSheet, View } from 'react-native';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { SectionEyebrow } from '~/components/shared/section-eyebrow';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { NutrientRow } from './nutrient-row';

interface SteadySectionProps {
  cards: NutrientCardData[];
}

/**
 * RN port of web `components/nutrition/sections/steady-section.tsx`. The web's
 * `sm:grid-cols-2` split collapses to a single column on phone, so all rows go
 * in one list (no left/right border).
 */
export function SteadySection({ cards }: SteadySectionProps) {
  const t = useTranslations('nutrition');
  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <SectionEyebrow label={t('steady.eyebrow')} />
        <Text style={styles.hint}>{t('steady.hint')}</Text>
      </View>
      <View style={styles.list}>
        {cards.map((card) => (
          <NutrientRow key={card.nutrient} card={card} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[4],
  },
  hint: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
  },
  list: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.borderHalf,
    overflow: 'hidden',
  },
});
