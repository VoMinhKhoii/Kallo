import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocale, useTranslations } from '~/i18n';
import {
  addDays,
  buildCenteredStripFromAnchor,
  dateStringToDate,
  formatTimelineDayLabel,
} from '~/lib/logging/timeline-utils';
import { Text } from '~/theme/text';
import { colors, radii, space } from '~/theme/tokens';

export interface TimelinePickerProps {
  /** Dates with logged meals — drives the "has meals" dots. */
  dates: string[];
  /** Local today (YYYY-MM-DD). Most-recent selectable date. */
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Chip (collapsed) vs week-strip (expanded). Lifted to the parent so the
   *  header can give the expanded strip the full row width. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

function DayCell({
  date,
  today,
  selectedDate,
  hasMeal,
  locale,
  labels,
  onSelect,
}: {
  date: string;
  today: string;
  selectedDate: string;
  hasMeal: boolean;
  locale: string;
  labels: { hasMeal: string; selectedDate: string; today: string };
  onSelect: (date: string) => void;
}) {
  const dateObj = useMemo(() => dateStringToDate(date), [date]);
  const isToday = date === today;
  const isSelected = date === selectedDate;
  const isFuture = date > today;

  const dayName = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dateObj),
    [locale, dateObj]
  );
  const accessibleDateLabel = useMemo(() => {
    const parts = [
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(dateObj),
    ];
    if (isToday) parts.push(labels.today);
    if (isSelected) parts.push(labels.selectedDate);
    if (hasMeal) parts.push(labels.hasMeal);
    return parts.join(', ');
  }, [dateObj, hasMeal, isSelected, isToday, labels, locale]);
  const dayNum = dateObj.getDate();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibleDateLabel}
      accessibilityState={{ selected: isSelected, disabled: isFuture }}
      disabled={isFuture}
      onPress={() => onSelect(date)}
      style={({ pressed }) => [
        styles.cell,
        isSelected && styles.cellSelected,
        isToday && !isSelected && styles.cellToday,
        isFuture && styles.cellFuture,
        pressed && !isFuture && styles.cellPressed,
      ]}
    >
      <Text
        variant="macroLabel"
        style={[styles.cellDayName, isSelected && styles.cellTextSelected]}
      >
        {dayName}
      </Text>
      <Text
        variant="numInline"
        style={[styles.cellDayNum, isSelected && styles.cellTextSelected]}
      >
        {dayNum}
      </Text>
      {isFuture ? (
        <View style={styles.dotSpacer} />
      ) : hasMeal ? (
        <View
          style={[styles.dot, isSelected ? styles.dotOnSelected : styles.dotMeal]}
        />
      ) : (
        <View style={styles.dotEmpty} />
      )}
    </Pressable>
  );
}

export function TimelinePicker({
  dates,
  today,
  selectedDate,
  onSelectDate,
  expanded,
  onExpandedChange,
}: TimelinePickerProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();

  const mealDates = useMemo(() => new Set(dates), [dates]);
  const hasMeal = mealDates.has(selectedDate);
  const formattedDate = formatTimelineDayLabel(selectedDate, locale);
  const dayCellLabels = useMemo(
    () => ({
      hasMeal: t('hasMealIndicator'),
      selectedDate: t('selectedDateLabel'),
      today: t('todayLabel'),
    }),
    [t]
  );

  // Anchor = visual center of the 7-day strip. The most-recent allowed anchor
  // is `today` so we never page into a window that's entirely in the future.
  const currentAnchor = today;
  const selectedAnchor = useMemo(
    () => (selectedDate > currentAnchor ? currentAnchor : selectedDate),
    [currentAnchor, selectedDate]
  );
  const [visibleAnchor, setVisibleAnchor] = useState(selectedAnchor);

  const week = useMemo(
    () => buildCenteredStripFromAnchor(visibleAnchor),
    [visibleAnchor]
  );

  const canNavigateNext = visibleAnchor < currentAnchor;

  const handleOpenStrip = useCallback(() => {
    setVisibleAnchor(selectedAnchor);
    onExpandedChange(true);
  }, [selectedAnchor, onExpandedChange]);

  const handleSelectDay = useCallback(
    (date: string) => {
      if (date !== selectedDate) {
        onSelectDate(date);
      }
      onExpandedChange(false);
    },
    [onSelectDate, onExpandedChange, selectedDate]
  );

  const navigateToAnchor = useCallback(
    (anchor: string) => {
      const nextAnchor = anchor > currentAnchor ? currentAnchor : anchor;
      setVisibleAnchor((current) =>
        nextAnchor === current ? current : nextAnchor
      );
    },
    [currentAnchor]
  );

  const scrollPrev = useCallback(() => {
    navigateToAnchor(addDays(visibleAnchor, -7));
  }, [navigateToAnchor, visibleAnchor]);

  const scrollNext = useCallback(() => {
    if (!canNavigateNext) return;
    navigateToAnchor(addDays(visibleAnchor, 7));
  }, [canNavigateNext, navigateToAnchor, visibleAnchor]);

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('selectDate')}
        accessibilityState={{ expanded: false }}
        onPress={handleOpenStrip}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <CalendarIcon size={14} color={colors.accent} />
        <Text variant="chipText" numberOfLines={1} style={styles.chipLabel}>
          {formattedDate}
        </Text>
        {hasMeal ? (
          <View
            accessibilityRole="text"
            accessibilityLabel={t('hasMealIndicator')}
            style={[styles.dot, styles.dotMeal]}
          />
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('previousWeek')}
        hitSlop={4}
        onPress={scrollPrev}
        style={({ pressed }) => [styles.chevron, pressed && styles.chevronPressed]}
      >
        <ChevronLeft size={18} color={colors.textMuted} />
      </Pressable>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel={t('selectDate')}
        style={styles.week}
      >
        {week.days.map((date) => (
          <DayCell
            key={date}
            date={date}
            today={today}
            selectedDate={selectedDate}
            hasMeal={mealDates.has(date)}
            locale={locale}
            labels={dayCellLabels}
            onSelect={handleSelectDay}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nextWeek')}
        accessibilityState={{ disabled: !canNavigateNext }}
        disabled={!canNavigateNext}
        hitSlop={4}
        onPress={scrollNext}
        style={({ pressed }) => [
          styles.chevron,
          pressed && canNavigateNext && styles.chevronPressed,
        ]}
      >
        <ChevronRight
          size={18}
          color={canNavigateNext ? colors.textMuted : colors.placeholderMuted40}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- chip mode ----
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 40,
    maxWidth: 288,
    paddingHorizontal: space[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderHalf,
    backgroundColor: colors.surface,
  },
  chipPressed: { backgroundColor: colors.hover },
  chipLabel: { flexShrink: 1, color: colors.text },
  // ---- strip mode ----
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    alignSelf: 'stretch',
    width: '100%',
  },
  week: { flex: 1, flexDirection: 'row', gap: space[1] },
  chevron: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  chevronPressed: { backgroundColor: colors.hover },
  // ---- day cell ----
  cell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: space[1],
    paddingHorizontal: 2,
    borderRadius: radii.xl,
  },
  cellSelected: { backgroundColor: colors.accentSelectedFill },
  cellToday: { backgroundColor: colors.timelineDotFill },
  cellFuture: { opacity: 0.55 },
  cellPressed: { backgroundColor: colors.hover },
  cellDayName: { color: colors.textMuted },
  cellDayNum: { color: colors.textMuted, fontSize: 13 },
  cellTextSelected: { color: colors.text },
  // ---- dots ----
  dot: { width: 6, height: 6, borderRadius: radii.pill },
  dotMeal: { backgroundColor: colors.accent },
  dotOnSelected: { backgroundColor: colors.surface80 },
  dotEmpty: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderFaint,
  },
  dotSpacer: { width: 6, height: 6 },
});
