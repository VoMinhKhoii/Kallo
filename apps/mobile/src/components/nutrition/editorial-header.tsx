import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
        <View style={styles.titleBlock}>
          <SectionEyebrow
            label={t('editorial.eyebrow')}
            trailing={tRange(resolvedRange)}
          />
          <Text style={styles.date}>{dateRange}</Text>
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={tRange('label')}
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
                style={[
                  styles.toggleBtn,
                  active && styles.toggleBtnActive,
                  disabled && styles.toggleDisabled,
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
        </View>
      </View>

      {verdict ? <View style={styles.verdictWrap}>{verdict}</View> : null}
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
