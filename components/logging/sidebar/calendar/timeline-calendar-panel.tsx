'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { DateLib, labelDayButton } from 'react-day-picker';
import { enUS, vi as viLocale } from 'react-day-picker/locale';
import { Calendar } from '@/components/ui/calendar';
import type { MealDateIndex } from '@/lib/domain/logging/meal-date-index';
import { meetsCompletenessFloor } from '@/lib/domain/nutrition/pattern/completeness';
import { dateStringToDate, dateToDateString } from '../timeline-utils';
import { CalendarDayButton } from './calendar-day-button';
import { DayProgressContext } from './day-progress-context';

/**
 * DayPicker formats month names, weekday headings and the day cells'
 * accessible labels itself — next-intl does not reach it. Without this the
 * grid stays English inside an otherwise Vietnamese surface. The locale data
 * rides the dynamic import, so it costs the logging route nothing until the
 * calendar opens.
 *
 * From `react-day-picker/locale`, NOT `date-fns/locale`. They look
 * interchangeable and are not: DayPicker's own locales re-export the date-fns
 * ones and add a `labels` bag holding the strings DayPicker writes rather than
 * formats — the month-nav buttons, and the "Today, …" / "…, selected" wrappers
 * on every day button. A bare date-fns locale carries none of those, so the
 * dates came out Vietnamese inside English scaffolding.
 */
function dayPickerLocale(locale: string) {
  return locale === 'vi' ? viLocale : enUS;
}

export interface TimelineCalendarPanelProps {
  today: string;
  selectedDate: string;
  mealDates: MealDateIndex;
  /** The day's kcal goal the rings fill toward; null draws empty tracks. */
  calorieTarget: number | null;
  onSelectDate: (date: string) => void;
}

/**
 * The month grid inside the sidebar's calendar dialog.
 *
 * Split from the trigger so it can be loaded on demand: this file is what
 * pulls in react-day-picker, and the logging page should not pay for it until
 * somebody actually opens the calendar. The dialog owns the heading and the
 * legend, so this renders the grid alone.
 *
 * Every day is a fixed 46px hit target spread across the row, holding a calorie
 * ring (see `CalendarDayButton`). The shared `Calendar` sizes its cells off one
 * `--cell-size` and stretches them to fill, so the layout keys below are
 * restated here rather than patched in `components/ui` — that file belongs to
 * the shadcn CLI, and the expiry banner's calendar should not change with this
 * one.
 */
export function TimelineCalendarPanel({
  today,
  selectedDate,
  mealDates,
  calorieTarget,
  onSelectDate,
}: TimelineCalendarPanelProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const dayPicker = dayPickerLocale(locale);
  const selected = dateStringToDate(selectedDate);
  const progressSource = useMemo(
    () => ({ mealDates, calorieTarget }),
    [mealDates, calorieTarget]
  );

  return (
    <DayProgressContext.Provider value={progressSource}>
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected}
        locale={dayPicker}
        className="w-full bg-transparent p-0"
        // Other months' days were most of the old grid's clutter — and the
        // ring a trailing "1" would carry belongs to a month not on screen.
        showOutsideDays={false}
        // Monday, to match the tree behind it: `getWeekStart` and `weekOfMonth`
        // both count from Monday, so a Sunday-first grid would put
        // "Week 4 · Sep 21 - Sep 27" next to a row starting Sep 20.
        weekStartsOn={1}
        // You cannot have eaten a day that hasn't happened. The tree clamps the
        // same way; without this the calendar would be the one way back into a
        // future date.
        disabled={{ after: dateStringToDate(today) }}
        onSelect={(date) => {
          if (date) onSelectDate(dateToDateString(date));
        }}
        formatters={{
          // date-fns spells the Vietnamese month out ("Tháng Chín 2026"); the
          // app writes months as numbers everywhere else ("Tháng 9").
          ...(locale === 'vi' && {
            formatCaption: (month, options, dateLib) =>
              (dateLib ?? new DateLib(options)).format(month, "'Tháng' M, y"),
          }),
          // "Mon" rather than DayPicker's two-letter "Mo"; "Thứ 2" in Vietnamese.
          formatWeekdayName: (weekday, options, dateLib) =>
            (dateLib ?? new DateLib(options)).format(weekday, 'EEE'),
        }}
        classNames={CALENDAR_CLASS_NAMES}
        components={{ DayButton: CalendarDayButton }}
        modifiers={{
          hasMeal: (date) => mealDates.has(dateToDateString(date)),
        }}
        // The ring is drawn, not read: its numbers go in the button's accessible
        // name, as the sidebar's own date buttons already do with their totals.
        //
        // Delegates to the LOCALE's label, not the package default: DayPicker's
        // `getLabels` resolves a custom label ahead of the locale's, so
        // overriding here would otherwise throw away the localized wrapper and
        // announce a Vietnamese date as "Today, …, selected".
        labels={{
          labelDayButton: (date, modifiers, options, dateLib) => {
            // A locale's label may be a plain string for the fixed ones, so the
            // type is `string | fn` across the bag; DayPicker's own resolveLabel
            // branches the same way.
            const localized = dayPicker.labels?.labelDayButton;
            const base =
              typeof localized === 'function'
                ? localized(date, modifiers, options, dateLib)
                : labelDayButton(date, modifiers, options, dateLib);
            if (!modifiers.hasMeal) return base;

            const parts = [base, t('hasMealIndicator')];
            const kcal = mealDates.kcal(dateToDateString(date));
            if (kcal !== null && calorieTarget !== null && calorieTarget > 0) {
              parts.push(
                t('calendarDayKcal', {
                  kcal: Math.round(kcal),
                  target: calorieTarget,
                }),
                meetsCompletenessFloor(kcal, calorieTarget)
                  ? t('targetMet')
                  : t('belowTarget')
              );
            }
            return parts.join(', ');
          },
        }}
      />
    </DayProgressContext.Provider>
  );
}

const NAV_BUTTON =
  'flex size-9 items-center justify-center rounded-xl border border-kallo-border bg-white text-kallo-text-soft transition-colors hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent aria-disabled:pointer-events-none aria-disabled:opacity-40';

/**
 * Replaces the shared calendar's keys wholesale (DayPicker takes the object
 * as given, it does not merge per key). Notably `today` is emptied: the shared
 * one washes today's CELL in the accent, which under a selected today showed
 * as squared-off corners around the rounded button.
 */
const CALENDAR_CLASS_NAMES = {
  root: 'w-full',
  months: 'relative flex flex-col',
  month: 'flex w-full flex-col gap-3',
  nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
  button_previous: NAV_BUTTON,
  button_next: NAV_BUTTON,
  month_caption: 'flex h-9 items-center justify-center',
  caption_label: 'select-none font-serif text-[17px] text-kallo-text',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex justify-between',
  weekday:
    'w-[46px] select-none pb-1 font-medium font-sans-display text-[12px] text-kallo-text-muted',
  week: 'mt-2 flex w-full justify-between',
  // Fixed, so the cell a hidden outside day leaves behind still holds its
  // column — a collapsed empty cell would slide the rest of the row left.
  day: 'size-[46px] p-0 text-center',
  today: '',
  disabled: '',
  outside: '',
  hidden: 'invisible',
};
