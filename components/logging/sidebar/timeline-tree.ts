import {
  dateToDateString,
  getSelectedMonthKey,
  getWeekDateRange,
  weekOfMonth,
} from './timeline-utils';

export interface WeekSection {
  key: string;
  weekNumber: number;
  /** Ascending, which is the order the sidebar renders them in. */
  days: string[];
}

export interface MonthSection {
  key: string;
  month: number;
  year: number;
  weeks: WeekSection[];
}

export interface BuildTimelineTreeInput {
  /** Days the user actually logged something on. */
  dates: string[];
  today: string;
  selectedDate: string;
}

interface MonthKeyParts {
  month: number;
  year: number;
}

/**
 * Which months the tree covers: the ones holding a log, plus the ones the user
 * is standing in. Reaching a month with no logs at all is the calendar's job,
 * not the tree's.
 */
function collectMonthKeys(
  input: BuildTimelineTreeInput
): Map<string, MonthKeyParts> {
  const months = new Map<string, MonthKeyParts>();

  for (const dateStr of [...input.dates, input.today, input.selectedDate]) {
    const key = getSelectedMonthKey(dateStr);
    if (months.has(key)) continue;

    const [year, month] = dateStr.split('-').map(Number);
    months.set(key, { month, year });
  }

  return months;
}

/**
 * Every day of one calendar week, as `getWeekDateRange` bounds it — already
 * clamped to the month, so the first and last weeks stay partial.
 */
function daysInWeek(parts: MonthKeyParts, weekNumber: number): string[] {
  const range = getWeekDateRange({
    year: parts.year,
    month: parts.month,
    weekNumber,
  });
  const monthIndex = parts.month - 1;
  const firstDay = Number(range.start.split('-')[2]);
  const lastDay = Number(range.end.split('-')[2]);
  const days: string[] = [];

  for (let day = firstDay; day <= lastDay; day++) {
    days.push(dateToDateString(new Date(parts.year, monthIndex, day)));
  }

  return days;
}

function weeksInMonth(parts: MonthKeyParts): number {
  const lastOfMonth = new Date(parts.year, parts.month, 0);
  return weekOfMonth(dateToDateString(lastOfMonth));
}

/**
 * Builds the month → week → day tree the desktop sidebar renders.
 *
 * Unlike `groupByMonth`, which only ever emits days that came in, this fills
 * each covered month with ALL of its calendar days. A day you logged nothing on
 * is still a day you can open and log against — the composer, the `?date=`
 * param and every write path already handle it; until now there was just no row
 * to click. `hasMeal` in the sidebar keeps saying which is which.
 *
 * Days after `today` are dropped: you cannot have eaten them yet. Two things
 * survive that clamp — `selectedDate`, so a future date arriving by URL still
 * has a row to sit on rather than silently selecting nothing, and any day that
 * actually holds a log. `today` is the browser's, while `dates` are stamped
 * server-side against a timezone offset, so the two can disagree by a few hours
 * around midnight; a real meal is never hidden over that.
 */
export function buildTimelineTree(
  input: BuildTimelineTreeInput
): MonthSection[] {
  const logged = new Set(input.dates);
  const isReachable = (date: string) =>
    date <= input.today || date === input.selectedDate || logged.has(date);
  const sections: MonthSection[] = [];

  for (const [key, parts] of collectMonthKeys(input)) {
    const weeks: WeekSection[] = [];
    // Hoisted: in the loop condition this re-ran every iteration, and each run
    // allocates a Date and calls weekOfMonth, which allocates two more.
    const weekCount = weeksInMonth(parts);

    for (let weekNumber = 1; weekNumber <= weekCount; weekNumber++) {
      // Already ascending — `daysInWeek` counts up and `filter` preserves
      // order. The sidebar renders ascending, so emitting descending here only
      // bought a re-sort on every render.
      const days = daysInWeek(parts, weekNumber).filter(isReachable);

      if (days.length === 0) continue;

      weeks.push({ key: `${key}-w${weekNumber}`, weekNumber, days });
    }

    if (weeks.length === 0) continue;

    sections.push({ key, month: parts.month, year: parts.year, weeks });
  }

  sections.sort((a, b) => b.year - a.year || b.month - a.month);

  return sections;
}
