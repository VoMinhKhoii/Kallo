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

export interface BuildMobileRailDatesInput {
  allDates: string[];
  selectedDate: string;
  today: string;
  limit: number;
}

export interface MobileRailDates {
  mobileDates: string[];
  hasHiddenDates: boolean;
}

export type MobileChipRelativeLabel =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'lastWeekday'; weekday: string }
  | { kind: 'date' };

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

/**
 * Formats a compact date label with weekday.
 * Example: "Sun 3"
 */
export function formatCompactDayLabel(dateStr: string, locale: string): string {
  const date = dateStringToDate(dateStr);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Returns the week number within a month (1-5) using Math.ceil(day / 7).
 */
export function weekOfMonth(dateStr: string): number {
  const date = dateStringToDate(dateStr);
  const day = date.getDate();
  return Math.ceil(day / 7);
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
  sections.sort((a, b) => b.key.localeCompare(a.key));

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
  const selectedTime = dateStringToDate(input.date).getTime();
  const todayTime = dateStringToDate(input.today).getTime();

  const dayDiff = Math.round(
    (todayTime - selectedTime) / (1000 * 60 * 60 * 24)
  );

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

/**
 * Builds mobile rail dates with required dates (selectedDate, today) always preserved,
 * then fills remaining slots with closest dates by calendar distance (preferring newer on ties).
 * Returns dates sorted descending and a flag indicating if dates were hidden.
 */
export function buildMobileRailDates(
  input: BuildMobileRailDatesInput
): MobileRailDates {
  const { allDates, selectedDate, today, limit } = input;

  // Step 1: Build unique set including required dates
  const uniqueDates = new Set<string>([...allDates, selectedDate, today]);

  // Step 2: Separate required dates from remaining dates
  const requiredDates = new Set<string>([selectedDate, today]);
  const remainingDates = Array.from(uniqueDates).filter(
    (date) => !requiredDates.has(date)
  );

  // Step 3: Calculate effective limit
  const effectiveLimit = Math.max(limit, requiredDates.size);

  // Step 4: Rank remaining dates by distance from selectedDate
  const selectedTime = dateStringToDate(selectedDate).getTime();

  remainingDates.sort((a, b) => {
    const aTime = dateStringToDate(a).getTime();
    const bTime = dateStringToDate(b).getTime();

    const aDist = Math.abs(aTime - selectedTime);
    const bDist = Math.abs(bTime - selectedTime);

    if (aDist !== bDist) {
      return aDist - bDist;
    }

    // Ties: prefer newer dates (descending)
    return b.localeCompare(a);
  });

  // Step 5: Select dates up to effective limit
  const slotsForRemaining = effectiveLimit - requiredDates.size;
  const selectedRemaining = remainingDates.slice(0, slotsForRemaining);

  // Step 6: Combine required + selected remaining
  const mobileDates = [...Array.from(requiredDates), ...selectedRemaining].sort(
    (a, b) => b.localeCompare(a)
  );

  // Step 7: Determine if dates were hidden
  const hasHiddenDates = uniqueDates.size > mobileDates.length;

  return {
    mobileDates,
    hasHiddenDates,
  };
}
