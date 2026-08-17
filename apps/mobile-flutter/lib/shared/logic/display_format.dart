/// Number/date shaping for display — locale thousands grouping, the round-to-
/// whole helper, and the local `YYYY-MM-DD` day key.
///
/// Dashboard, logging and onboarding all read these, which is why they live
/// here rather than inside any one feature.
///
/// Ported from `apps/mobile/src/lib/dashboard/logic/format.ts` and the
/// `todayDateString` helper used by the dashboard screen.
library;

import 'package:intl/intl.dart';

/// Rounds to a whole number, mapping null to 0. Mirrors web `round0`.
int round0(num? n) => n == null ? 0 : n.round();

/// Locale-aware thousands grouping (en → "2,000", vi → "2.000"). Mirrors the
/// web's `toLocaleString()` instead of the hardcoded comma grouping.
String formatCount(int n, String locale) =>
    NumberFormat.decimalPattern(locale).format(n);

/// Local `YYYY-MM-DD` for [date] (defaults to now). Matches the web/RN
/// `todayDateString` — uses LOCAL date components, not UTC.
String todayDateString([DateTime? date]) {
  final d = date ?? DateTime.now();
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}
