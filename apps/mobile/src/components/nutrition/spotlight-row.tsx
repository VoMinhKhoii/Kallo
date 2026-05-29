import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { TargetProgressBar } from '~/components/shared/target-progress-bar';
import { useLocale, useTranslations } from '~/i18n';
import { formatLocalizedNumber, shouldShowExceed } from '~/lib/nutrition/helpers';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';
import { FoodChipRow } from './food-chip-row';

interface SpotlightRowProps {
  card: NutrientCardData;
  /** Entrance delay, ms (mirrors the web per-card motion stagger). */
  delay?: number;
}

/** RN port of web `components/nutrition/rows/spotlight-row.tsx`. */
export function SpotlightRow({ card, delay = 0 }: SpotlightRowProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const label = tRoot(card.labelKey);
  const percent = card.percentOfTarget ?? 0;
  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);
  const figure =
    showExceed && percent > 100
      ? `+${Math.round(percent - 100)}%`
      : t('focus.percentOfTarget', { value: Math.round(percent) });

  return (
    // Web motion.article opacity/y:8 duration 0.5 delay 0.1 + index*0.06.
    <Animated.View
      entering={FadeInDown.duration(500)
        .delay(delay)
        .reduceMotion(ReduceMotion.System)}
      style={styles.article}
    >
      <View style={styles.headRow}>
        <Text style={styles.heading}>{label}</Text>
        <Text style={[styles.figure, showExceed && styles.figureExceed]}>
          {figure}
        </Text>
      </View>

      <View style={styles.barRow}>
        <TargetProgressBar
          percentOfTarget={card.percentOfTarget}
          showExceed={showExceed}
          delay={delay + 100}
          accessibilityLabel={t('focus.spotlightBarAria', {
            label,
            pct: Math.round(percent),
          })}
        />
        {card.target === null ? null : (
          <Text style={styles.target}>
            {`${formatLocalizedNumber(card.target, locale)} ${card.unit}`}
          </Text>
        )}
      </View>

      <Text style={styles.averageLine}>
        {t('focus.averageLine', {
          value:
            card.averagePerDay === null
              ? '—'
              : formatLocalizedNumber(card.averagePerDay, locale),
          unit: card.unit,
          source: tRoot(card.targetSourceLabelKey),
        })}
      </Text>

      <FoodChipRow nutrient={card.nutrient} variant="spotlight" limit={5} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  article: { gap: space[3] },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  heading: {
    flexShrink: 1,
    fontFamily: fonts.serifMedium,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.21,
    color: colors.text,
  },
  figure: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  figureExceed: { color: colors.danger },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  target: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  averageLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
