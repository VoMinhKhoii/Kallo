import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { MacroPattern } from '@/lib/nutrition/types';
import { TargetProgressBar } from '~/components/shared/target-progress-bar';
import { SectionEyebrow } from '~/components/shared/section-eyebrow';
import { useLocale, useTranslations } from '~/i18n';
import { formatLocalizedNumber, shouldShowExceed } from '~/lib/nutrition/logic/helpers';
import {
  buildComposition,
  COMPOSITION_COLORS,
  COMPOSITION_SHORT,
  consistencyLabelKey,
  orderedMacroRows,
} from '~/lib/nutrition/logic/rhythm-logic';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

interface DailyRhythmProps {
  macros: MacroPattern[];
}

/** RN port of web `components/nutrition/sections/daily-rhythm.tsx`. */
export function DailyRhythm({ macros }: DailyRhythmProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const calories = macros.find((m) => m.key === 'calories');
  const { totalKcal, segments } = buildComposition(macros);
  const macroRows = orderedMacroRows(macros);

  return (
    // Web section motion.div opacity/y:8 duration 0.5 delay 0.1.
    <Animated.View
      entering={FadeInDown.duration(500)
        .delay(100)
        .reduceMotion(ReduceMotion.System)}
      style={styles.section}
    >
      <SectionEyebrow label={t('rhythm.eyebrow')} delay={100} />

      <View style={styles.card}>
        {/* Calorie hero — stacks above the composition pill on phone. */}
        <View>
          <Text style={styles.calorieLine}>
            <Text style={styles.calorieNumber}>
              {calories
                ? formatLocalizedNumber(calories.averagePerDay, locale)
                : '—'}
            </Text>
            <Text style={styles.calorieUnit}> {t('rhythm.calories')}</Text>
          </Text>
          <Text style={styles.avgLabel}>{t('rhythm.avgPerLoggedDay')}</Text>
        </View>

        {totalKcal > 0 ? (
          <View style={styles.compositionBlock}>
            <CompositionPill
              segments={segments}
              ariaLabel={t('rhythm.macroCompositionAria')}
            />
            <View style={styles.legend}>
              {segments.map((segment) => (
                <View key={segment.key} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: COMPOSITION_COLORS[segment.key] },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {COMPOSITION_SHORT[segment.key]} {Math.round(segment.pct)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.macroRows}>
          {macroRows.map((macro) => (
            <MacroRow
              key={macro.key}
              macro={macro}
              locale={locale}
              label={tRoot(macro.labelKey)}
              consistencyLabel={t(consistencyLabelKey(macro.consistencyPct))}
              barAriaLabel={t('rhythm.barAria', { macro: tRoot(macro.labelKey) })}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

interface CompositionPillProps {
  segments: { key: keyof typeof COMPOSITION_COLORS; pct: number }[];
  ariaLabel: string;
}

/**
 * The macro composition bar. Web animates each segment `scaleX 0→1` from the
 * left (transformOrigin:left, duration 0.6 delay 0.15 easeOut) — they share the
 * same left origin, so scaling the whole row group reproduces the "draw out"
 * effect while preserving each segment's relative width exactly.
 */
function CompositionPill({ segments, ariaLabel }: CompositionPillProps) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      150,
      withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }],
  }));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={ariaLabel}
      style={styles.pill}
    >
      <Animated.View style={[styles.pillFill, fillStyle]}>
        {segments.map((segment) =>
          segment.pct > 0 ? (
            <View
              key={segment.key}
              style={{
                width: `${segment.pct}%`,
                height: '100%',
                backgroundColor: COMPOSITION_COLORS[segment.key],
              }}
            />
          ) : null
        )}
      </Animated.View>
    </View>
  );
}

interface MacroRowProps {
  macro: MacroPattern;
  locale: string;
  label: string;
  consistencyLabel: string;
  barAriaLabel: string;
}

function MacroRow({
  macro,
  locale,
  label,
  consistencyLabel,
  barAriaLabel,
}: MacroRowProps) {
  const ratio =
    macro.target && macro.target > 0
      ? macro.averagePerDay / macro.target
      : null;
  const pctOfTarget = ratio === null ? null : ratio * 100;
  const showExceed = shouldShowExceed(macro.nutrientType, pctOfTarget);

  let figure: string;
  if (macro.target === null || macro.target <= 0) {
    figure = `${formatLocalizedNumber(macro.averagePerDay, locale)} ${macro.unit}`;
  } else {
    const pct = Math.round((macro.averagePerDay / macro.target) * 100);
    figure = showExceed && pct > 100 ? `+${pct - 100}%` : `${pct}%`;
  }

  return (
    <View style={styles.macroRow}>
      <Text numberOfLines={1} style={styles.macroLabel}>
        {label}
      </Text>
      <View style={styles.macroBarCell}>
        <TargetProgressBar
          percentOfTarget={pctOfTarget}
          showExceed={showExceed}
          duration={600}
          accessibilityLabel={barAriaLabel}
        />
      </View>
      <Text style={styles.macroTarget}>
        {macro.target === null
          ? ''
          : `${formatLocalizedNumber(macro.target, locale)} ${macro.unit}`}
      </Text>
      <View style={styles.macroRight}>
        <Text style={styles.consistency}>{consistencyLabel}</Text>
        <Text style={[styles.macroFigure, showExceed && styles.macroFigureExceed]}>
          {figure}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[4] },
  card: {
    // Web rounded-3xl = 24 (radii['3xl'] is 22, intentionally kept for dashboard).
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface80,
    padding: space[5],
    gap: space[6],
  },
  calorieLine: { flexDirection: 'row', alignItems: 'baseline' },
  calorieNumber: {
    fontFamily: fonts.serifMedium,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.7,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  calorieUnit: {
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    color: colors.textMuted,
  },
  avgLabel: {
    marginTop: space[1],
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    // Web tracking-[0.18em] @ 12px ≈ 2.16.
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  compositionBlock: { gap: space[2] },
  pill: {
    flexDirection: 'row',
    height: 8,
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  // Segment group scaled from the left for the "draw out" entrance.
  pillFill: { flexDirection: 'row', height: '100%', width: '100%', transformOrigin: 'left' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: radii.pill },
  legendText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  macroRows: {
    gap: space[3],
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderBiscotti40,
    paddingTop: space[5],
  },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  macroLabel: {
    width: 88,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
  },
  macroBarCell: { flex: 1 },
  macroTarget: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  macroRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  consistency: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.text,
  },
  macroFigure: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  macroFigureExceed: { color: colors.danger },
});
