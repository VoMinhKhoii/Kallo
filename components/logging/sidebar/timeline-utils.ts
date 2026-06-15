export interface WeekStrip {
  days: string[];
}

export interface WeekSection {
  key: string;
  weekNumber: number;
  days: string[];
}

export interface MonthSection {
  key: string;
  month: number;
  year: number;
  weeks: WeekSection[];
}

export interface BuildAllTimelineDatesInput {
  dates: string[];
  today: string;
  selectedDate: string;
}

export type MobileChipRelativeLabel =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'lastWeekday'; weekday: string }
  | { kind: 'date' };

export interface WeekDateRange {
  start: string;
  end: string;
}

/**
 * Converts a YYYY-MM-DD date string to a local Date object at midnight.
 */
export function dateStringToDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Converts a Date object to YYYY-MM-DD format using local time.
 */
export function dateToDateString(date: Date): string {
  return todayDateString(date);
}

function dateStringToUtcDayNumber(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
}

export function addDays(dateStr: string, days: number): string {
  const date = dateStringToDate(dateStr);
  date.setDate(date.getDate() + days);
  return dateToDateString(date);
}

/**
 * Returns a date string in YYYY-MM-DD format.
 */
export function todayDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date label with weekday.
 * Example: "Sun, May 3"
 */
export function formatDayLabel(dateStr: string, locale: string): string {
  const date = dateStringToDate(dateStr);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatTimelineDayLabel(
  dateStr: string,
  locale: string
): string {
  const date = dateStringToDate(dateStr);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
  }).format(date);
  const day = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${weekday} - ${day}`;
}

/**
 * Returns the week number within a month (1-5) using Monday-based calendar weeks.
 * The first partial week (days before the first Monday) is Week 1.
 * Each subsequent Monday starts a new week.
 */
export function weekOfMonth(dateStr: string): number {
  const date = dateStringToDate(dateStr);
  const day = date.getDate();
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun … 6=Sat
  // Number of days in the partial first week (before the first Monday).
  // When the month starts on Monday (firstDayOfWeek===1), this is 0 → full weeks only.
  const daysBeforeFirstMonday = (8 - firstDayOfWeek) % 7;

  if (daysBeforeFirstMonday === 0) {
    return Math.ceil(day / 7);
  }
  if (day <= daysBeforeFirstMonday) {
    return 1;
  }
  return Math.ceil((day - daysBeforeFirstMonday) / 7) + 1;
}

/**
 * Returns a month key in MM-YYYY format.
 * Example: "05-2026"
 */
export function getSelectedMonthKey(dateStr: string): string {
  const date = dateStringToDate(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${year}`;
}

/**
 * Returns a week key in MM-YYYY-wN format.
 * Example: "05-2026-w1"
 */
export function getSelectedWeekKey(dateStr: string): string {
  const monthKey = getSelectedMonthKey(dateStr);
  const week = weekOfMonth(dateStr);
  return `${monthKey}-w${week}`;
}

export function getWeekDateRange(input: {
  year: number;
  month: number;
  weekNumber: number;
}): WeekDateRange {
  const monthIndex = input.month - 1;
  const firstOfMonth = new Date(input.year, monthIndex, 1);
  const firstDayOfWeek = firstOfMonth.getDay();
  const daysBeforeFirstMonday = (8 - firstDayOfWeek) % 7;
  const daysInMonth = new Date(input.year, input.month, 0).getDate();

  let startDay: number;
  let endDay: number;

  if (daysBeforeFirstMonday === 0) {
    // Month starts on Monday — pure 7-day weeks
    startDay = (input.weekNumber - 1) * 7 + 1;
    endDay = Math.min(input.weekNumber * 7, daysInMonth);
  } else if (input.weekNumber === 1) {
    // Partial first week: day 1 through the day before the first Monday
    startDay = 1;
    endDay = daysBeforeFirstMonday;
  } else {
    // Full week starting from the first Monday
    startDay = daysBeforeFirstMonday + (input.weekNumber - 2) * 7 + 1;
    endDay = Math.min(
      daysBeforeFirstMonday + (input.weekNumber - 1) * 7,
      daysInMonth
    );
  }

  return {
    start: dateToDateString(new Date(input.year, monthIndex, startDay)),
    end: dateToDateString(new Date(input.year, monthIndex, endDay)),
  };
}

export function formatWeekDateRange(
  range: WeekDateRange,
  locale: string
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(dateStringToDate(range.start))} - ${formatter.format(
    dateStringToDate(range.end)
  )}`;
}

export function sortTimelineDaysAscending(days: string[]): string[] {
  return [...days].sort((a, b) => a.localeCompare(b));
}

export function getWeekStart(dateStr: string): string {
  const date = dateStringToDate(dateStr);
  const dayOfWeek = date.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateToDateString(date);
}

export function addWeeks(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7);
}

export function weekDistanceInWeeks(
  olderWeekStart: string,
  newerWeekStart: string
) {
  return Math.round(
    (dateStringToUtcDayNumber(newerWeekStart) -
      dateStringToUtcDayNumber(olderWeekStart)) /
      7
  );
}

export function clampWeekStartToCurrent(
  weekStart: string,
  currentWeekStart: string
): string {
  return weekStart > currentWeekStart ? currentWeekStart : weekStart;
}

export function buildWeekStripFromStart(weekStart: string): WeekStrip {
  const start = getWeekStart(weekStart);
  const days: string[] = [];

  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }

  return { days };
}

/**
 * Builds a 7-day strip with `anchor` placed at index 3 (the visual center).
 * Used by the mobile chip so a double-tap on the chip's old position lands on
 * the currently selected date instead of an adjacent day.
 */
export function buildCenteredStripFromAnchor(anchor: string): WeekStrip {
  const start = addDays(anchor, -3);
  const days: string[] = [];

  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }

  return { days };
}

/**
 * Builds a de-duplicated, descending-sorted list of all timeline dates,
 * including saved dates, today, and selected date.
 */
export function buildAllTimelineDates(
  input: BuildAllTimelineDatesInput
): string[] {
  const uniqueDates = new Set<string>([
    ...input.dates,
    input.today,
    input.selectedDate,
  ]);

  return Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
}

/**
 * Builds consecutive Monday–Sunday week strips spanning the full range of the
 * provided dates. The returned strips are sorted oldest-first.
 */
export function buildWeekStrips(allDates: string[]): WeekStrip[] {
  if (allDates.length === 0) return [];

  const sorted = [...allDates].sort();
  const minWeekStart = getWeekStart(sorted[0]);
  const maxWeekStart = getWeekStart(sorted[sorted.length - 1]);
  const weekCount = weekDistanceInWeeks(minWeekStart, maxWeekStart);
  const strips: WeekStrip[] = [];

  for (let i = 0; i <= weekCount; i++) {
    strips.push(buildWeekStripFromStart(addWeeks(minWeekStart, i)));
  }

  return strips;
}

/**
 * Groups dates by month and week, sorted descending by month.
 */
export function groupByMonth(dates: string[]): MonthSection[] {
  const monthMap = new Map<string, MonthSection>();

  for (const dateStr of dates) {
    const monthKey = getSelectedMonthKey(dateStr);
    const weekKey = getSelectedWeekKey(dateStr);
    const date = dateStringToDate(dateStr);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const week = weekOfMonth(dateStr);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        key: monthKey,
        month,
        year,
        weeks: [],
      });
    }

    const monthSection = monthMap.get(monthKey)!;
    let weekSection = monthSection.weeks.find((w) => w.key === weekKey);

    if (!weekSection) {
      weekSection = {
        key: weekKey,
        weekNumber: week,
        days: [],
      };
      monthSection.weeks.push(weekSection);
    }

    weekSection.days.push(dateStr);
  }

  const sections = Array.from(monthMap.values());
  sections.sort((a, b) => b.year - a.year || b.month - a.month);

  for (const section of sections) {
    section.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
    for (const week of section.weeks) {
      week.days.sort((a, b) => b.localeCompare(a));
    }
  }

  return sections;
}

/**
 * Formats a compact date for the mobile chip (e.g., "Mon, May 4").
 */
export function formatMobileChipDate(dateStr: string, locale: string): string {
  const date = dateStringToDate(dateStr);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Returns a structured relative label for the mobile chip.
 * - today: selected date is today
 * - yesterday: selected date is yesterday
 * - lastWeekday: selected date is 2-6 days ago (returns localized weekday)
 * - date: all other cases (future or older than 6 days)
 */
export function getMobileChipRelativeLabel(input: {
  date: string;
  today: string;
  locale: string;
}): MobileChipRelativeLabel {
  const dayDiff =
    dateStringToUtcDayNumber(input.today) -
    dateStringToUtcDayNumber(input.date);

  if (dayDiff === 0) {
    return { kind: 'today' };
  }

  if (dayDiff === 1) {
    return { kind: 'yesterday' };
  }

  if (dayDiff >= 2 && dayDiff <= 6) {
    const date = dateStringToDate(input.date);
    const weekday = new Intl.DateTimeFormat(input.locale, {
      weekday: 'short',
    }).format(date);
    return { kind: 'lastWeekday', weekday };
  }

  return { kind: 'date' };
}
