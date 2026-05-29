import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { SectionEyebrow } from '~/components/shared/section-eyebrow';
import { useTranslations } from '~/i18n';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';
import { NutrientRow } from './nutrient-row';

interface BackgroundSectionProps {
  cards: NutrientCardData[];
}

/**
 * RN port of web `components/nutrition/sections/background-section.tsx`. The
 * AnimatePresence height collapse becomes a Reanimated fade (RN can't animate
 * `height:auto`); single-column on phone.
 */
export function BackgroundSection({ cards }: BackgroundSectionProps) {
  const t = useTranslations('nutrition');
  const [open, setOpen] = useState(false);

  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <SectionEyebrow label={t('background.eyebrow')} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
        >
          <Text style={styles.toggle}>
            {open
              ? t('background.hide')
              : t('background.show', { count: cards.length })}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(150)}
          style={styles.panel}
        >
          <Text style={styles.hint}>{t('background.hint')}</Text>
          <View style={styles.list}>
            {cards.map((card) => (
              <NutrientRow key={card.nutrient} card={card} />
            ))}
          </View>
        </Animated.View>
      ) : null}
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
  toggle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.text,
  },
  panel: { gap: space[2] },
  hint: {
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
