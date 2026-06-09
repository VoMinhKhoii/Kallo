/// Number/date helpers for the dashboard surface.
///
/// Ported from `apps/mobile/src/lib/dashboard/logic/format.ts` and the
/// `todayDateString` helper used by the dashboard screen.
library;

/// Rounds to a whole number, mapping null to 0. Mirrors web `round0`.
int round0(num? n) => n == null ? 0 : n.round();

/// Local `YYYY-MM-DD` for [date] (defaults to now). Matches the web/RN
/// `todayDateString` — uses LOCAL date components, not UTC.
String todayDateString([DateTime? date]) {
  final d = date ?? DateTime.now();
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}
