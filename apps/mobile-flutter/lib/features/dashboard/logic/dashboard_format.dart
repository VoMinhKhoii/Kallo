/// Number/date helpers for the dashboard surface.
///
/// Ported from `apps/mobile/src/lib/dashboard/logic/format.ts` and the
/// `todayDateString` / `getWeekTitle` helpers used by the dashboard screen.
library;

import 'package:intl/intl.dart';

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

/// The 7 local `DateTime`s (Mon→Sun) of the Monday-anchored week containing
/// [today] (a local `YYYY-MM-DD`). Reuses the same Monday math as [getWeekTitle].
List<DateTime> weekDaysFor(String today) {
  final parts = today.split('-').map(int.parse).toList();
  final now = DateTime(parts[0], parts[1], parts[2]);
  final weekday = now.weekday % 7; // Dart Mon=1..Sun=7 → Sun=0..Sat=6.
  final diffToMon = weekday == 0 ? -6 : 1 - weekday;
  final monday = DateTime(now.year, now.month, now.day + diffToMon);
  return [
    for (var i = 0; i < 7; i++)
      DateTime(monday.year, monday.month, monday.day + i),
  ];
}

/// Builds "Week of {Mon} – {Sun}, {year}" for the Monday-anchored week
/// containing [today] (a local `YYYY-MM-DD`). Vendored from the RN
/// `getWeekTitle` (dashboard.tsx).
///
/// [label] is the localized "Week of" prefix; [locale] drives the month-name
/// formatting (RN passes `'en'` explicitly, matching the inlined COPY).
String getWeekTitle(String locale, String label, String today) {
  final parts = today.split('-').map(int.parse).toList();
  final y = parts[0];
  final m = parts[1];
  final dd = parts[2];

  // JS `new Date(y, m-1, d)` (0-based month) == Dart `DateTime(y, m, d)`
  // (1-based), so pass `m` straight through.
  final now = DateTime(y, m, dd);
  final weekday = now.weekday % 7; // Dart: Mon=1..Sun=7 → JS Sun=0..Sat=6.
  final diffToMon = weekday == 0 ? -6 : 1 - weekday;
  final monday = DateTime(y, m, dd + diffToMon);
  final sunday = DateTime(monday.year, monday.month, monday.day + 6);

  final formatter = DateFormat.MMMMd(locale);
  final year = sunday.year;

  return '$label ${formatter.format(monday)} – ${formatter.format(sunday)}, $year';
}
