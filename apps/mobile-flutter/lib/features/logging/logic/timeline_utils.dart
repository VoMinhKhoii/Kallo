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
