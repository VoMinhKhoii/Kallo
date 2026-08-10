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

/// How many day buckets fit before per-bucket labels start colliding.
const int _denseDayAxis = 7;

/// Same, for the wider `d/M` week-bucket label.
const int _denseWeekAxis = 8;

/// 30d anchors on the same weekday the range started on.
const int _dayAnchorStep = 7;

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
/// Apple Health's ladder: a short range labels every column; a long day axis
/// (30d, 30 columns) anchors weekly on the day number; a long week axis (90d,
/// 13 columns) anchors at month boundaries. Labelling all 30 or all 13 collides
/// at phone widths.
List<String> buildBucketTickLabels(
  List<String> startDates,
  String unit,
  String locale,
) {
  final dense = unit == 'week'
      ? startDates.length > _denseWeekAxis
      : startDates.length > _denseDayAxis;
  if (!dense) {
    return [for (final date in startDates) bucketLabel(date, unit, locale)];
  }

  if (unit == 'day') {
    return [
      for (var i = 0; i < startDates.length; i++)
        if (i % _dayAnchorStep != 0)
          ''
        else
          DateTime.tryParse(startDates[i])?.day.toString() ?? '',
    ];
  }

  // Week buckets: name the month at the first column and wherever the axis
  // crosses into a new one, so 90 days reads as "Jun · Jul · Aug".
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
