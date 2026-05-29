import { StyleSheet, View } from 'react-native';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { SectionEyebrow } from '~/components/shared/section-eyebrow';
import { useTranslations } from '~/i18n';
import { colors, space } from '~/theme/tokens';
import { SpotlightRow } from './spotlight-row';

interface FocusSectionProps {
  cards: NutrientCardData[];
}

/** RN port of web `components/nutrition/sections/focus-section.tsx`. */
export function FocusSection({ cards }: FocusSectionProps) {
  const t = useTranslations('nutrition');
  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionEyebrow label={t('focus.eyebrow')} />
      <View style={styles.rows}>
        {cards.map((card, index) => (
          <View
            key={card.nutrient}
            style={index < cards.length - 1 ? styles.divided : undefined}
          >
            <SpotlightRow card={card} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[5] },
  rows: { gap: space[6] },
  divided: {
    borderBottomWidth: 1,
    borderColor: colors.borderBiscotti40,
    paddingBottom: space[6],
  },
});
