/// Pure timeline date helpers — vendored 1:1 from web
/// `components/logging/sidebar/timeline-utils.ts`. `todayDateString`
/// lives in `logging_keys.dart` so the local YYYY-MM-DD format has one source.
library;

import 'package:intl/intl.dart';

import '../data/logging_keys.dart';

/// A 7-day strip of YYYY-MM-DD date strings.
class WeekStrip {
  const WeekStrip(this.days);
  final List<String> days;
}

/// Convert a YYYY-MM-DD string to a local [DateTime] at midnight.
DateTime dateStringToDate(String dateStr) {
  final parts = dateStr.split('-').map(int.parse).toList();
  // JS used `month - 1` against a 0-based month; Dart's DateTime month is
  // 1-based, so we pass `parts[1]` directly.
  return DateTime(parts[0], parts[1], parts[2]);
}

/// Convert a [DateTime] to YYYY-MM-DD using local time.
String dateToDateString(DateTime date) => todayDateString(date);

/// Shift a YYYY-MM-DD string by [days] (can be negative).
String addDays(String dateStr, int days) {
  final date = dateStringToDate(dateStr);
  final shifted = DateTime(date.year, date.month, date.day + days);
  return dateToDateString(shifted);
}

/// Compact chip label: weekday + month/day. Example: `Sun - May 3`.
String formatTimelineDayLabel(String dateStr, String locale) {
  final date = dateStringToDate(dateStr);
  final weekday = DateFormat('EEE', locale).format(date);
  final day = DateFormat('MMM d', locale).format(date);
  return '$weekday - $day';
}

/// Build a 7-day strip with [anchor] at index 3 (the visual center), so tapping
/// the chip's old position lands on the selected date, not an adjacent day.
WeekStrip buildCenteredStripFromAnchor(String anchor) {
  final start = addDays(anchor, -3);
  final days = <String>[];
  for (var i = 0; i < 7; i++) {
    days.add(addDays(start, i));
  }
  return WeekStrip(days);
}

// ── Week paging ───────────────────────────────────────────────────────────
//
// A large midpoint so a PageView can page many weeks into the past while the
// current week sits at a known index (weeks are unbounded backwards, and
// clamped at today going forward).
const int kWeekPageBase = 5000;

/// The anchor date (the centre day, index 3 of [buildCenteredStripFromAnchor])
/// of the week shown at [page], counting weeks back from [today] at
/// [kWeekPageBase].
String weekAnchorForPage(String today, int page) =>
    addDays(today, (page - kWeekPageBase) * 7);

/// The inverse of [weekAnchorForPage]: the page index whose week holds [anchor].
int weekPageForAnchor(String today, String anchor) =>
    kWeekPageBase + (calendarDaysBetween(today, anchor) / 7).round();

/// Whole calendar days from [from] to [to] (negative when [to] is earlier).
///
/// Both ends are placed at UTC midnight before subtracting. Local-midnight
/// `DateTime`s straddling a DST change are 23 or 25 hours apart, so a plain
/// `difference().inDays` truncates one day short (2024-03-09 → 03-13 in
/// America/New_York is 95 hours, "3 days") and a pager keyed on it lands one
/// week off. UTC has no such hour, so the day count is exact.
int calendarDaysBetween(String from, String to) {
  final a = dateStringToDate(from);
  final b = dateStringToDate(to);
  return DateTime.utc(
    b.year,
    b.month,
    b.day,
  ).difference(DateTime.utc(a.year, a.month, a.day)).inDays;
}
