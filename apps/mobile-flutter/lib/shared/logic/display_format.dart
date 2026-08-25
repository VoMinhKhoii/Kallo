/// Number/date shaping for display — locale thousands grouping, the round-to-
/// whole helper, and the local `YYYY-MM-DD` day key.
///
/// Dashboard, logging and onboarding all read these, which is why they live
/// here rather than inside any one feature.
///
/// Web counterparts: `formatLocalizedNumber` in
/// `components/nutrition/primitives/helpers.ts` for the grouping, and the
/// `YYYY-MM-DD` day key in `lib/core/date/day-key.ts` (keep in sync).
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

/// The clock time a meal was logged, in the VIEWER's zone.
///
/// Both surfaces that list meals want the same thing: they are already grouped
/// by day, so an elapsed span ("2h ago") repeats what the day heading just
/// said and buries what it did not — what time of day the meal was eaten.
///
/// Callers pass the timestamp that reflects when the meal was ANALYSED, not a
/// backfill's chosen date: the Circle feed passes `sharedAt`, the dock passes
/// `loggedAt`. A backfilled entry's clock time is meaningless, and the feed
/// hides the timestamp for those rather than printing a misleading one.
String formatLoggedTime(DateTime value, {required String locale}) =>
    DateFormat.jm(locale).format(value.toLocal());
