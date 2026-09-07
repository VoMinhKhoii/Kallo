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

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// First letter upper-cased, the rest left exactly as typed.
///
/// Meal names are whatever the user wrote into the composer, so they arrive
/// lower-case as often as not; a card that prints "phở bò" reads as a fragment
/// rather than as the meal's name. Applied at the RENDER site (see
/// `shared/widgets/nutrition/meal_block.dart`), never on the model — the raw
/// input has to survive intact for editing and re-logging.
///
/// A name whose FIRST WORD already carries an upper-case letter is left alone:
/// barcode and OCR products arrive with the brand's own casing ("belVita
/// cookies (30g)", "iPro shake"), and upper-casing the first grapheme rewrites
/// a brand name the user never typed. Only an all-lower-case first word is
/// something the composer plausibly produced.
///
/// Grapheme-based, not `s[0]`: Vietnamese diacritics can be composed from two
/// code units, and indexing would split one. Mirrors web `capitalizeFirst`
/// (`lib/core/text/capitalize.ts`), brand rule included. A name starting with
/// a digit or an emoji comes back untouched, which is what upper-casing a
/// non-letter does.
String capitalizeFirst(String s) {
  if (s.isEmpty) return s;
  final String first = s.split(' ').first;
  if (first != first.toLowerCase()) return s;
  return s.characters.first.toUpperCase() + s.characters.skip(1).toString();
}

/// Rounds to a whole number, mapping null to 0. Mirrors web `round0`.
int round0(num? n) => n == null ? 0 : n.round();

/// Locale-aware thousands grouping (en → "2,000", vi → "2.000"). Mirrors the
/// web's `toLocaleString()` instead of the hardcoded comma grouping.
String formatCount(int n, String locale) =>
    NumberFormat.decimalPattern(locale).format(n);

/// The locale to format figures for, from whatever scope is mounted.
///
/// `Localizations.maybeLocaleOf`, not easy_localization's `context.locale`:
/// the app's `MaterialApp` is always configured with the latter, so inside the
/// app the two agree — but the widget tests that make GEOMETRY claims pump a
/// bare `Directionality` with no localization scope at all, and a number
/// formatter has no business forcing them to mount one. Falls back to `en`,
/// whose grouping is what an unlocalized surface would have shown anyway.
String localeOf(BuildContext context) =>
    Localizations.maybeLocaleOf(context)?.toString() ?? 'en';

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
