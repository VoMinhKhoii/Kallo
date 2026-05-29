import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
} from 'react-native-reanimated';
import type {
  NutritionRange,
  NutritionRangeInput,
} from '@/lib/nutrition/types';
import { SectionEyebrow } from '~/components/shared/section-eyebrow';
import { useLocale, useTranslations } from '~/i18n';
import { formatDate } from '~/lib/nutrition/format-date';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

const RANGES = ['7d', '30d', '90d'] as const satisfies readonly NutritionRange[];

interface EditorialHeaderProps {
  resolvedRange: NutritionRange;
  onRangeChange: (range: NutritionRangeInput) => void;
  startDate: string;
  endDate: string;
  disabled?: boolean;
  /** The verdict line — rendered full-width below the title row on phone. */
  verdict?: ReactNode;
}

/** RN port of web `components/nutrition/sections/editorial-header.tsx`. */
export function EditorialHeader({
  resolvedRange,
  onRangeChange,
  startDate,
  endDate,
  disabled,
  verdict,
}: EditorialHeaderProps) {
  const t = useTranslations('nutrition');
  const tRange = useTranslations('nutrition.range');
  const locale = useLocale();
  const dateRange = t('editorial.dateRange', {
    start: formatDate(startDate, locale),
    end: formatDate(endDate, locale),
  });

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {/* Title block: web motion.div opacity/y:6 duration 0.5 (no delay). */}
        <Animated.View
          entering={FadeInDown.duration(500).reduceMotion(ReduceMotion.System)}
          style={styles.titleBlock}
        >
          <SectionEyebrow
            label={t('editorial.eyebrow')}
            trailing={tRange(resolvedRange)}
            delay={0}
          />
          <Text style={styles.date}>{dateRange}</Text>
        </Animated.View>

        {/* Range toggle: web motion.div opacity/y:6 duration 0.5 delay 0.05. */}
        <Animated.View
          accessibilityRole="radiogroup"
          accessibilityLabel={tRange('label')}
          entering={FadeInDown.duration(500)
            .delay(50)
            .reduceMotion(ReduceMotion.System)}
          style={styles.toggle}
        >
          {RANGES.map((range) => {
            const active = resolvedRange === range;
            return (
              <Pressable
                key={range}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !!disabled }}
                disabled={disabled}
                onPress={() => onRangeChange(range)}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  active && styles.toggleBtnActive,
                  disabled && styles.toggleDisabled,
                  // Web inactive `hover:text-nham-text` → RN pressed bg highlight.
                  pressed && !active && styles.toggleBtnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    active && styles.toggleLabelActive,
                  ]}
                >
                  {tRange(range)}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>

      {/* Verdict: web motion.div opacity/y:4 duration 0.5 delay 0.1. */}
      {verdict ? (
        <Animated.View
          entering={FadeInDown.duration(500)
            .delay(100)
            .reduceMotion(ReduceMotion.System)}
          style={styles.verdictWrap}
        >
          {verdict}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[4],
    borderBottomWidth: 1,
    borderColor: colors.borderHalf,
    paddingBottom: space[5],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  titleBlock: { flexShrink: 1, gap: space[2] },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 2,
  },
  toggleBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  toggleBtnActive: { backgroundColor: colors.text },
  toggleBtnPressed: { backgroundColor: colors.hover40 },
  toggleDisabled: { opacity: 0.6 },
  toggleLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  toggleLabelActive: { color: colors.surface },
  verdictWrap: { width: '100%' },
});
