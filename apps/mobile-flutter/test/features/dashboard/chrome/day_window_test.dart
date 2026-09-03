import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/logic/day_window.dart';
import 'package:kallo_mobile/features/logging/logic/timeline_utils.dart';

/// The day pager's window is unbounded into the past and clamped at today, so
/// there is no list of days to index — pages map to dates arithmetically.
void main() {
  test('today sits at the base page, and it is the last one', () {
    expect(dateForDayPage('2026-09-03', kDayPageBase), '2026-09-03');
    expect(dayPageForDate('2026-09-03', '2026-09-03'), kDayPageBase);
  });

  test('lower pages are earlier days', () {
    expect(dateForDayPage('2026-09-03', kDayPageBase - 1), '2026-09-02');
    expect(dateForDayPage('2026-09-03', kDayPageBase - 10), '2026-08-24');
    expect(dayPageForDate('2026-09-03', '2026-08-24'), kDayPageBase - 10);
  });

  test('a day after today maps above the base page (the pager rejects it)', () {
    expect(dayPageForDate('2026-09-03', '2026-09-04'), kDayPageBase + 1);
  });

  test('round-trips across a month boundary', () {
    for (var i = 0; i < 40; i++) {
      final page = kDayPageBase - i;
      final date = dateForDayPage('2026-09-03', page);
      expect(dayPageForDate('2026-09-03', date), page, reason: 'page $page');
    }
    expect(dateForDayPage('2026-09-03', kDayPageBase - 3), '2026-08-31');
  });

  test('round-trips across a year boundary', () {
    expect(dateForDayPage('2026-01-02', kDayPageBase - 2), '2025-12-31');
    expect(dayPageForDate('2026-01-02', '2025-12-31'), kDayPageBase - 2);
    expect(dateForDayPage('2026-01-02', kDayPageBase - 367), '2024-12-31');
    expect(dayPageForDate('2026-01-02', '2024-12-31'), kDayPageBase - 367);
  });

  test('round-trips across a leap day', () {
    expect(dateForDayPage('2028-03-01', kDayPageBase - 1), '2028-02-29');
    expect(dayPageForDate('2028-03-01', '2028-02-29'), kDayPageBase - 1);
  });

  test('a year of days round-trips exactly', () {
    for (var i = 0; i <= 365; i++) {
      final date = dateForDayPage('2026-09-03', kDayPageBase - i);
      expect(dayPageForDate('2026-09-03', date), kDayPageBase - i);
    }
  });

  // Local-midnight DateTimes across a DST change are 23/25 hours apart, so a
  // naive `difference().inDays` undercounts; the helpers count calendar days
  // on UTC midnights instead. These run in whatever zone CI has, so they pin
  // the arithmetic on the spring-forward (2024-03-10) and fall-back
  // (2024-11-03) weeks of America/New_York — the dates CodeRabbit flagged.
  group('calendar days are exact across DST boundaries', () {
    test('spring forward: 2024-03-09 → 2024-03-13 is four days', () {
      expect(calendarDaysBetween('2024-03-09', '2024-03-13'), 4);
      expect(calendarDaysBetween('2024-03-13', '2024-03-09'), -4);
      expect(dayPageForDate('2024-03-13', '2024-03-09'), kDayPageBase - 4);
    });

    test('fall back: 2024-11-02 → 2024-11-06 is four days', () {
      expect(calendarDaysBetween('2024-11-02', '2024-11-06'), 4);
      expect(dayPageForDate('2024-11-06', '2024-11-02'), kDayPageBase - 4);
    });

    test('the week pager lands on the week holding a date across DST', () {
      // Today is the Wednesday after spring-forward; the Saturday before it
      // (four days back) is still the same week page, one earlier is not.
      const today = '2024-03-13';
      expect(weekPageForAnchor(today, '2024-03-09'), kWeekPageBase - 1);
      expect(weekPageForAnchor(today, '2024-03-06'), kWeekPageBase - 1);
      expect(weekPageForAnchor(today, '2024-03-11'), kWeekPageBase);
      expect(
        weekPageForAnchor(today, weekAnchorForPage(today, kWeekPageBase - 3)),
        kWeekPageBase - 3,
      );
    });
  });
}
