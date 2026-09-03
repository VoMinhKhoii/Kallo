import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/logic/day_window.dart';

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
}
