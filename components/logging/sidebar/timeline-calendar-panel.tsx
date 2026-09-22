'use client';

import { enUS, vi as viLocale } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { labelDayButton } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { dateStringToDate, dateToDateString } from './timeline-utils';

/**
 * DayPicker formats month names, weekday headings and the day cells'
 * accessible labels itself, from a date-fns locale — next-intl does not reach
 * it. Without this the grid stays English inside an otherwise Vietnamese
 * surface. The locale data rides the dynamic import, so it costs the logging
 * route nothing until the calendar opens.
 */
function dateFnsLocale(locale: string) {
  return locale === 'vi' ? viLocale : enUS;
}

/**
 * The tan dot under a day that already holds a log. Exported because
 * react-day-picker applies a modifier as a CLASS on the day cell rather than
 * as an attribute, so this string is the only handle the marker has — and the
 * test that checks the marker should not restate it.
 */
export const HAS_MEAL_MARKER_CLASS =
  "after:-translate-x-1/2 after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:rounded-full after:bg-kallo-accent after:content-['']";

export interface TimelineCalendarPanelProps {
  today: string;
  selectedDate: string;
  dailyKcal: Map<string, number | null>;
  onSelectDate: (date: string) => void;
}

/**
 * The month grid inside the sidebar's calendar dialog.
 *
 * Split from the trigger so it can be loaded on demand: this file is what
 * pulls in react-day-picker, and the logging page should not pay for it until
 * somebody actually opens the calendar. The dialog owns the heading, so this
 * renders the grid alone.
 */
export function TimelineCalendarPanel({
  today,
  selectedDate,
  dailyKcal,
  onSelectDate,
}: TimelineCalendarPanelProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const selected = dateStringToDate(selectedDate);

  return (
    <Calendar
      mode="single"
      selected={selected}
      defaultMonth={selected}
      locale={dateFnsLocale(locale)}
      className="mx-auto bg-transparent p-0"
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
      modifiers={{
        hasMeal: (date) => dailyKcal.has(dateToDateString(date)),
      }}
      modifiersClassNames={{ hasMeal: HAS_MEAL_MARKER_CLASS }}
      // The marker is a CSS `after:` dot, which a screen reader cannot see.
      // Without naming it, finding the days that hold a log means opening them
      // one at a time — so the state goes in the button's accessible name, as
      // the sidebar's own date buttons already do with their totals.
      labels={{
        labelDayButton: (date, modifiers, options, dateLib) => {
          const base = labelDayButton(date, modifiers, options, dateLib);
          return modifiers.hasMeal ? `${base}, ${t('hasMealIndicator')}` : base;
        },
      }}
    />
  );
}
