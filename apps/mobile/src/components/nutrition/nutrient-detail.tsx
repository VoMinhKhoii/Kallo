import { StyleSheet, View } from 'react-native';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { TargetProgressBar } from '~/components/shared/target-progress-bar';
import { useLocale, useTranslations } from '~/i18n';
import { formatLocalizedNumber, shouldShowExceed } from '~/lib/nutrition/helpers';
import { showChips } from '~/lib/nutrition/status';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';
import { FoodChipRow } from './food-chip-row';

interface NutrientDetailProps {
  card: NutrientCardData;
}

/** RN port of web `components/nutrition/rows/nutrient-detail.tsx`. */
export function NutrientDetail({ card }: NutrientDetailProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const label = tRoot(card.labelKey);

  const hasTarget = card.percentOfTarget !== null;
  const percent = card.percentOfTarget ?? 0;
  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

  const avgText =
    card.averagePerDay === null
      ? null
      : t('focus.averageLine', {
          value: formatLocalizedNumber(card.averagePerDay, locale),
          unit: card.unit,
          source: tRoot(card.targetSourceLabelKey),
        });

  return (
    <View style={styles.wrap}>
      {hasTarget ? (
        <>
          <View style={styles.barRow}>
            <TargetProgressBar
              percentOfTarget={card.percentOfTarget}
              showExceed={showExceed}
              duration={550}
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
          {avgText ? <Text style={styles.avg}>{avgText}</Text> : null}
        </>
      ) : avgText ? (
        <Text style={styles.avg}>{avgText}</Text>
      ) : (
        <Text style={styles.noData}>{t('card.noData')}</Text>
      )}

      {showChips(card) ? (
        <FoodChipRow nutrient={card.nutrient} variant="spotlight" limit={5} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4], paddingTop: space[2] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  target: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  avg: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  noData: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textMuted,
  },
});
