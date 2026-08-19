/// Pure nutrition helpers vendored verbatim from web
/// `components/nutrition/primitives/helpers.ts` (keep in sync).
library;

import 'package:intl/intl.dart';

import '../../../models/nutrition/nutrition.dart';

/// Whether a card's coverage is too thin to state a verdict — it mutes the
/// figure and withholds the green "on target" tier.
///
/// This is the SAME 40% coverage line the server's `getNutrientStatus` uses,
/// not the wider `limitedData` band. `getConfidenceDisplayState` labels 40–70%
/// coverage `limitedData`, but that band still shows a full, trustworthy
/// percentage — so treating it as unverdictable made a nutrient that clearly
/// cleared its floor (niacin at 106%) render grey while announcing 106%. The
/// card said "enough" and looked like "not enough".
///
/// Mirror of web `isLowConfidence` (keep in sync).
bool isLowConfidence(ConfidenceDisplayState state) =>
    state == ConfidenceDisplayState.warningPoints ||
    state == ConfidenceDisplayState.insufficientData;

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
