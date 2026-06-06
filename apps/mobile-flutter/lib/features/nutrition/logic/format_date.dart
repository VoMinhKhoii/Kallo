/// Vendored from web `components/nutrition/sections/editorial-header.tsx`
/// `formatDate` (keep in sync). Noon anchor avoids DST/timezone day-shift when
/// parsing a bare `YYYY-MM-DD`.
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/format-date.ts`.
library;

import 'package:intl/intl.dart';

/// Formats a bare `YYYY-MM-DD` date as a short `MMM d` string in [locale].
String formatDate(String date, String locale) {
  // Noon anchor avoids DST/timezone day-shift (matches the web `T12:00:00`).
  final parsed = DateTime.parse('${date}T12:00:00');
  return DateFormat.MMMd(locale).format(parsed);
}
