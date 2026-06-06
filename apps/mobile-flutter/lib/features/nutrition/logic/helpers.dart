/// Pure nutrition helpers vendored verbatim from web
/// `components/nutrition/primitives/helpers.ts` (keep in sync).
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/helpers.ts`.
library;

import 'package:intl/intl.dart';

import '../../../models/nutrition.dart';

/// Whether a nutrient with the given type & % of target should render the
/// coral exceed indicator (danger color, +N% figure, coral end-tick).
///
/// - floor: never (above 100% on a minimum is good — RDAs are floors).
/// - ceiling: above 100% (e.g. sodium).
/// - range: outside ±10% band (e.g. calories on maintenance).
bool shouldShowExceed(NutrientType type, double? pct) {
  if (pct == null) return false;
  if (type == NutrientType.floor) return false;
  if (type == NutrientType.ceiling) return pct > 100;
  if (type == NutrientType.range) return pct > 110 || pct < 90;
  return false;
}

/// Locale-aware number formatter used across nutrition cards. Drops fraction
/// digits at >=100 to keep large grams and mg values compact, otherwise shows
/// a single decimal so e.g. 0.5g stays meaningful.
String formatLocalizedNumber(double value, String locale) {
  final fmt = NumberFormat.decimalPattern(locale)
    ..maximumFractionDigits = value >= 100 ? 0 : 1;
  return fmt.format(value);
}
