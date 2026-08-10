/// Vendored from web `components/nutrition/sections/editorial-header.tsx`
/// `formatDate` (keep in sync). Noon anchor avoids DST/timezone day-shift when
/// parsing a bare `YYYY-MM-DD`.
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/format-date.ts`.
library;

import 'package:characters/characters.dart';
import 'package:intl/intl.dart';

/// Formats a bare `YYYY-MM-DD` date as a short `MMM d` string in [locale].
String formatDate(String date, String locale) {
  // Noon anchor avoids DST/timezone day-shift (matches the web `T12:00:00`).
  final parsed = DateTime.parse('${date}T12:00:00');
  return DateFormat.MMMd(locale).format(parsed);
}

/// How many `d/M` week labels fit before they start colliding on a phone.
const int _denseWeekAxis = 8;

/// A single bucket's axis label: day buckets → weekday initial, week buckets →
/// `d/M` of the week start.
String bucketLabel(String startDate, String unit, String locale) {
  final d = DateTime.tryParse(startDate);
  if (d == null) return '';
  if (unit == 'week') return DateFormat('d/M', locale).format(d);
  // Vietnamese convention: weekday number for Mon–Sat, "CN" for Sunday. The
  // first grapheme of vi short weekdays ("Th 2".."Th 7"/"CN") yields six
  // indistinct "T"s, so use the numeric scheme instead (matches the web chart).
  if (locale.startsWith('vi')) {
    return d.weekday == DateTime.sunday ? 'CN' : (d.weekday + 1).toString();
  }
  return DateFormat('E', locale).format(d).characters.first;
}

/// One tick label per bucket, `''` where the axis should stay bare. Mirror of
/// web `buildBucketTickLabels` (keep in sync).
///
/// 7d (7 day columns) and 30d (5 week columns) label every column. 90d is 13
/// week columns, where 13 `d/M` labels collide — so it falls back to a month
/// name at the first column and at every crossing into a new month, reading
/// "Jun · Jul · Aug".
List<String> buildBucketTickLabels(
  List<String> startDates,
  String unit,
  String locale,
) {
  if (unit != 'week' || startDates.length <= _denseWeekAxis) {
    return [for (final date in startDates) bucketLabel(date, unit, locale)];
  }

  final month = DateFormat.MMM(locale);
  int? previousMonth;
  final labels = <String>[];
  for (final date in startDates) {
    final d = DateTime.tryParse(date);
    if (d == null) {
      labels.add('');
      continue;
    }
    if (previousMonth == d.month) {
      labels.add('');
      continue;
    }
    previousMonth = d.month;
    labels.add(month.format(d));
  }
  return labels;
}
