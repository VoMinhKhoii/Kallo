import { describe, expect, it } from 'vitest';
import {
  buildAllTimelineDates,
  buildMobileRailDates,
  dateStringToDate,
  dateToDateString,
  formatCompactDayLabel,
  formatDayLabel,
  formatMobileChipDate,
  getMobileChipRelativeLabel,
  getSelectedMonthKey,
  getSelectedWeekKey,
  groupByMonth,
  todayDateString,
  weekOfMonth,
} from './timeline-utils';

describe('timeline-utils', () => {
  describe('dateStringToDate', () => {
    it('converts YYYY-MM-DD to local Date at midnight', () => {
      const result = dateStringToDate('2026-05-03');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(4); // 0-indexed
      expect(result.getDate()).toBe(3);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('handles single-digit months and days', () => {
      const result = dateStringToDate('2026-01-05');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(5);
    });
  });

  describe('dateToDateString', () => {
    it('converts Date to YYYY-MM-DD using local time', () => {
      const date = new Date(2026, 4, 3, 12, 0, 0);
      const result = dateToDateString(date);
      expect(result).toBe('2026-05-03');
    });

    it('round-trips with dateStringToDate', () => {
      const original = '2026-05-03';
      const date = dateStringToDate(original);
      const result = dateToDateString(date);
      expect(result).toBe(original);
    });
  });

  describe('todayDateString', () => {
    it('returns date in YYYY-MM-DD format', () => {
      const result = todayDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('formats a specific date correctly', () => {
      const date = new Date(2026, 4, 3, 12, 0, 0);
      expect(todayDateString(date)).toBe('2026-05-03');
    });
  });

  describe('formatDayLabel', () => {
    it('includes weekday in the label', () => {
      const label = formatDayLabel('2026-05-03', 'en');
      expect(label).toContain('Sun');
    });
  });

  describe('formatCompactDayLabel', () => {
    it('includes weekday in the compact label', () => {
      const label = formatCompactDayLabel('2026-05-03', 'en');
      expect(label).toContain('Sun');
    });
  });

  describe('formatMobileChipDate', () => {
    it('formats with weekday, month, and day', () => {
      const label = formatMobileChipDate('2026-05-03', 'en');
      expect(label).toContain('Sun');
      expect(label).toContain('May');
      expect(label).toContain('3');
    });

    it('is locale-aware', () => {
      const labelEn = formatMobileChipDate('2026-05-03', 'en');
      const labelVi = formatMobileChipDate('2026-05-03', 'vi');
      expect(labelEn).not.toBe(labelVi);
    });
  });

  describe('getMobileChipRelativeLabel', () => {
    it('returns today when date matches today', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-05-03',
        today: '2026-05-03',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'today' });
    });

    it('returns yesterday when date is 1 day before today', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-05-02',
        today: '2026-05-03',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'yesterday' });
    });

    it('returns lastWeekday for dates 2-6 days ago', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-05-01',
        today: '2026-05-03',
        locale: 'en',
      });
      expect(result.kind).toBe('lastWeekday');
      if (result.kind === 'lastWeekday') {
        expect(result.weekday).toContain('Fri');
      }
    });

    it('returns date for dates older than 6 days', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-04-26',
        today: '2026-05-03',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'date' });
    });

    it('returns date for future dates', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-05-04',
        today: '2026-05-03',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'date' });
    });

    it('returns localized weekday for lastWeekday', () => {
      const result = getMobileChipRelativeLabel({
        date: '2026-05-01',
        today: '2026-05-03',
        locale: 'vi',
      });
      expect(result.kind).toBe('lastWeekday');
      if (result.kind === 'lastWeekday') {
        expect(result.weekday).toBeTruthy();
      }
    });

    it('handles DST transition correctly for yesterday (spring forward)', () => {
      // 2024-03-10 was spring DST in US (2am -> 3am)
      const result = getMobileChipRelativeLabel({
        date: '2024-03-09',
        today: '2024-03-10',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'yesterday' });
    });

    it('handles DST transition correctly for lastWeekday (spring forward)', () => {
      // 2024-03-10 was spring DST in US
      const result = getMobileChipRelativeLabel({
        date: '2024-03-08',
        today: '2024-03-10',
        locale: 'en',
      });
      expect(result.kind).toBe('lastWeekday');
      if (result.kind === 'lastWeekday') {
        expect(result.weekday).toBeTruthy();
      }
    });

    it('handles DST transition correctly for yesterday (fall back)', () => {
      // 2024-11-03 was fall DST in US (2am -> 1am)
      const result = getMobileChipRelativeLabel({
        date: '2024-11-02',
        today: '2024-11-03',
        locale: 'en',
      });
      expect(result).toEqual({ kind: 'yesterday' });
    });
  });

  describe('weekOfMonth', () => {
    it('calculates week 5 for the 31st', () => {
      expect(weekOfMonth('2026-05-31')).toBe(5);
    });

    it('calculates week 1 for the 1st', () => {
      expect(weekOfMonth('2026-05-01')).toBe(1);
    });

    it('calculates week 2 for the 8th', () => {
      expect(weekOfMonth('2026-05-08')).toBe(2);
    });
  });

  describe('getSelectedMonthKey', () => {
    it('returns month key in MM-YYYY format', () => {
      expect(getSelectedMonthKey('2026-05-03')).toBe('05-2026');
    });

    it('handles January correctly', () => {
      expect(getSelectedMonthKey('2026-01-15')).toBe('01-2026');
    });
  });

  describe('getSelectedWeekKey', () => {
    it('returns week key in MM-YYYY-wN format', () => {
      expect(getSelectedWeekKey('2026-05-03')).toBe('05-2026-w1');
    });

    it('calculates week correctly for end of month', () => {
      expect(getSelectedWeekKey('2026-05-31')).toBe('05-2026-w5');
    });
  });

  describe('groupByMonth', () => {
    it('groups dates into month sections with weeks', () => {
      const dates = ['2026-05-03', '2026-05-10'];
      const result = groupByMonth(dates);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('05-2026');
      expect(result[0].month).toBe(5);
      expect(result[0].year).toBe(2026);
      expect(result[0].weeks).toHaveLength(2);
      expect(result[0].weeks[0].weekNumber).toBe(1);
      expect(result[0].weeks[0].days).toContain('2026-05-03');
      expect(result[0].weeks[1].weekNumber).toBe(2);
      expect(result[0].weeks[1].days).toContain('2026-05-10');
    });

    it('handles multiple months', () => {
      const dates = ['2026-05-03', '2026-04-15', '2026-05-10'];
      const result = groupByMonth(dates);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('05-2026');
      expect(result[1].key).toBe('04-2026');
    });

    it('groups multiple dates in the same week', () => {
      const dates = ['2026-05-01', '2026-05-03', '2026-05-05'];
      const result = groupByMonth(dates);

      expect(result).toHaveLength(1);
      expect(result[0].weeks).toHaveLength(1);
      expect(result[0].weeks[0].days).toHaveLength(3);
    });

    it('sorts days within each week in descending order regardless of input order', () => {
      const dates = ['2026-05-01', '2026-05-05', '2026-05-03', '2026-05-02'];
      const result = groupByMonth(dates);

      expect(result).toHaveLength(1);
      expect(result[0].weeks).toHaveLength(1);
      expect(result[0].weeks[0].days).toEqual([
        '2026-05-05',
        '2026-05-03',
        '2026-05-02',
        '2026-05-01',
      ]);
    });
  });

  describe('buildAllTimelineDates', () => {
    it('de-duplicates dates and includes today and selectedDate', () => {
      const result = buildAllTimelineDates({
        dates: ['2026-05-01', '2026-05-03', '2026-05-01'],
        today: '2026-05-02',
        selectedDate: '2026-04-29',
      });

      expect(result).toEqual([
        '2026-05-03',
        '2026-05-02',
        '2026-05-01',
        '2026-04-29',
      ]);
    });

    it('sorts dates in descending order', () => {
      const result = buildAllTimelineDates({
        dates: ['2026-05-01', '2026-05-10', '2026-05-05'],
        today: '2026-05-02',
        selectedDate: '2026-05-03',
      });

      expect(result[0]).toBe('2026-05-10');
      expect(result[result.length - 1]).toBe('2026-05-01');
    });

    it('handles empty dates array', () => {
      const result = buildAllTimelineDates({
        dates: [],
        today: '2026-05-02',
        selectedDate: '2026-05-01',
      });

      expect(result).toEqual(['2026-05-02', '2026-05-01']);
    });
  });

  describe('buildMobileRailDates', () => {
    it('keeps selected date and today when limiting dates', () => {
      const result = buildMobileRailDates({
        allDates: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'],
        selectedDate: '2026-05-01',
        today: '2026-05-04',
        limit: 2,
      });

      expect(result.mobileDates).toContain('2026-05-01');
      expect(result.mobileDates).toContain('2026-05-04');
      expect(result.hasHiddenDates).toBe(true);
    });

    it('adds selected date and today even when missing from allDates', () => {
      const result = buildMobileRailDates({
        allDates: ['2026-05-05', '2026-05-06'],
        selectedDate: '2026-05-01',
        today: '2026-05-10',
        limit: 4,
      });

      expect(result.mobileDates).toContain('2026-05-01');
      expect(result.mobileDates).toContain('2026-05-10');
    });

    it('does not report hidden dates when all dates fit within the limit', () => {
      const result = buildMobileRailDates({
        allDates: ['2026-05-01', '2026-05-02', '2026-05-03'],
        selectedDate: '2026-05-02',
        today: '2026-05-03',
        limit: 5,
      });

      expect(result.mobileDates).toHaveLength(3);
      expect(result.hasHiddenDates).toBe(false);
    });

    it('ranks remaining dates by calendar distance from selected date', () => {
      const result = buildMobileRailDates({
        allDates: [
          '2026-05-01',
          '2026-05-02',
          '2026-05-05',
          '2026-05-08',
          '2026-05-15',
        ],
        selectedDate: '2026-05-05',
        today: '2026-05-05',
        limit: 3,
      });

      expect(result.mobileDates).toContain('2026-05-05');
      expect(result.mobileDates).toContain('2026-05-02');
      expect(result.mobileDates).toContain('2026-05-08');
    });

    it('prefers newer dates when distances are tied', () => {
      const result = buildMobileRailDates({
        allDates: ['2026-05-03', '2026-05-07', '2026-05-10'],
        selectedDate: '2026-05-05',
        today: '2026-05-05',
        limit: 2,
      });

      expect(result.mobileDates).toContain('2026-05-05');
      expect(result.mobileDates).toContain('2026-05-07');
    });

    it('returns dates sorted in descending order', () => {
      const result = buildMobileRailDates({
        allDates: ['2026-05-01', '2026-05-05', '2026-05-10'],
        selectedDate: '2026-05-05',
        today: '2026-05-05',
        limit: 3,
      });

      expect(result.mobileDates[0]).toBe('2026-05-10');
      expect(result.mobileDates[result.mobileDates.length - 1]).toBe(
        '2026-05-01'
      );
    });
  });
});
