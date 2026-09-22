'use client';

import { useTranslations } from 'next-intl';
import { Calendar } from '@/components/ui/calendar';
import { dateStringToDate, dateToDateString } from './timeline-utils';

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
 * The month grid behind the sidebar's calendar button.
 *
 * Split from the trigger so it can be loaded on demand: this file is what
 * pulls in react-day-picker, and the logging page should not pay for it until
 * somebody actually opens the calendar.
 */
export function TimelineCalendarPanel({
  today,
  selectedDate,
  dailyKcal,
  onSelectDate,
}: TimelineCalendarPanelProps) {
  const t = useTranslations('logging.timelineSidebar');
  const selected = dateStringToDate(selectedDate);

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 pt-3">
        <h2 className="font-medium font-sans-display text-kallo-text text-sm">
          {t('datePickerTitle')}
        </h2>
        <p className="text-kallo-text-muted text-xs">
          {t('datePickerDescription')}
        </p>
      </div>
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected}
        // Monday, to match the tree directly above it: `getWeekStart` and
        // `weekOfMonth` both count from Monday, so a Sunday-first grid would
        // put "Week 4 · Sep 21 - Sep 27" next to a row starting Sep 20.
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
      />
    </div>
  );
}
