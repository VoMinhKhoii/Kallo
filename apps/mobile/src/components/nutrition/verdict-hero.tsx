import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import type { NutritionOverview } from '@/lib/nutrition/types';
import { useLocale, useTranslations } from '~/i18n';
import {
  getAverageConfidence,
  joinNames,
  PERIOD_KEYS,
  takeNames,
} from '~/lib/nutrition/verdict-logic';
import { Text } from '~/theme/text';
import { colors, fonts, space } from '~/theme/tokens';

interface VerdictHeroProps {
  overview: NutritionOverview;
}

/** RN port of web `components/nutrition/sections/verdict-hero.tsx`. */
export function VerdictHero({ overview }: VerdictHeroProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const period = t(PERIOD_KEYS[overview.resolvedRange]);
  const consistent = joinNames(
    takeNames(overview.summary.mostConsistent, tRoot),
    locale
  );
  const attention = joinNames(
    takeNames(overview.summary.needsAttention, tRoot),
    locale
  );
  const tooFew = overview.trendStatus === 'too_few_logged_days';
  const dayFormatter = new Intl.NumberFormat(locale);

  let headline: string;
  let muted: string;

  if (tooFew) {
    headline = t('verdict.gathering');
    muted = t('verdict.gatheringSub', {
      days: dayFormatter.format(overview.completeDays),
    });
  } else {
    if (consistent && attention) {
      headline = t('verdict.both', { period, consistent, attention });
    } else if (consistent) {
      headline = t('verdict.steadyOnly', { period, consistent });
    } else if (attention) {
      headline = t('verdict.attentionOnly', { period, attention });
    } else {
      headline = t('verdict.quiet');
    }
    const avgConfidence = getAverageConfidence(overview);
    muted =
      avgConfidence === null
        ? t('verdict.trustLineNoConfidence', {
            days: dayFormatter.format(overview.completeDays),
          })
        : t('verdict.trustLine', {
            days: dayFormatter.format(overview.completeDays),
            confidence: new Intl.NumberFormat(locale, {
              maximumFractionDigits: 0,
            }).format(avgConfidence),
          });
    if (overview.partialDays > 0) {
      muted += ` ${t('verdict.partialNote', { count: overview.partialDays })}`;
    }
  }

  return (
    // Web motion.p opacity/y:4 duration 0.5 delay 0.05.
    <Animated.View
      entering={FadeInDown.duration(500)
        .delay(50)
        .reduceMotion(ReduceMotion.System)}
      style={styles.row}
    >
      <View style={styles.dot} />
      <Text style={styles.line}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.muted}>{`  ${muted}`}</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2] },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
    backgroundColor: colors.accent,
    marginTop: 7,
  },
  line: { flex: 1, lineHeight: 24 },
  headline: {
    fontFamily: fonts.serifMedium,
    fontSize: 14,
    lineHeight: 24,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textMuted,
  },
});
