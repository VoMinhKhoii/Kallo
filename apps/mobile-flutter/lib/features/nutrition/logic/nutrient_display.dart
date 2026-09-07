/// How a nutrient reads on a card — the figure, the "green it" test, and the
/// bar's colour.
///
/// Vendored from web `components/nutrition/rows/nutrient-grid-card.tsx` (keep
/// in sync). It lives in `logic/` rather than inside the widget because the
/// green tier is a rule about nutrition, not about layout, and because the
/// widget that used to own the figure/colour pair was deleted with the rows.
library;

import 'dart:ui';

import '../../../models/nutrition/nutrition.dart';
import '../../../theme/kallo_colors.dart';
import 'helpers.dart';
import 'status.dart';

/// Whether a nutrient reads as "on target" for the GREEN-CARD tier.
///
/// Deliberately NOT the server's `getNutrientStatus` bucket: a floor over 110%
/// greens here, because exceeding a minimum is good, where the server would
/// call it `above_target`. An exceeded CEILING is never on target. Mirror of
/// web `isOnTarget`.
bool isOnTarget(NutrientCardData card) {
  final pct = card.percentOfTarget;
  if (pct == null) return false;
  return switch (card.nutrientType) {
    NutrientType.floor => pct >= 90,
    NutrientType.ceiling => pct >= 90 && pct <= 100,
    // range: within ±10% of target.
    _ => (pct - 100).abs() <= 10,
  };
}

/// Whether the whole card goes green: on target, measured well enough to say
/// so, and not over a ceiling.
bool nutrientIsAdequate(NutrientCardData card) =>
    card.percentOfTarget != null &&
    !isLowConfidence(card.displayState) &&
    !shouldShowExceed(card.nutrientType, card.percentOfTarget) &&
    isOnTarget(card);

/// The card's headline figure — a PERCENTAGE, because the grid's job is
/// "how am I doing", answered at a glance across twenty cells. The absolute
/// avg/target reading sits underneath it ([nutrientGoalText]).
///
/// [limitedLabel] and [noTargetLabel] are passed in so this stays free of the
/// localisation scope.
String nutrientFigure(
  NutrientCardData card, {
  required String limitedLabel,
  required String noTargetLabel,
  required String Function(int) percentLabel,
}) {
  final pct = card.percentOfTarget;
  // Nothing measured at all — an empty range, or a bucket with no reading. A
  // dash, not "Limited": there is no thin reading to caveat, there is none.
  if (card.averagePerDay == null && pct == null) return '—';
  if (card.displayState == ConfidenceDisplayState.insufficientData) {
    return limitedLabel;
  }
  if (pct == null) return noTargetLabel;
  if (shouldShowExceed(card.nutrientType, pct) && pct > 100) {
    return '+${(pct - 100).round()}%';
  }
  return percentLabel(pct.round());
}

/// The absolute reading under the bar — "78.5 / 70 mg".
String nutrientGoalText(NutrientCardData card, String locale) {
  final avg = card.averagePerDay;
  final target = card.target;
  if (target != null) {
    final avgText = avg != null ? formatLocalizedNumber(avg, locale) : '—';
    return '$avgText / ${formatLocalizedNumber(target, locale)} ${card.unit}';
  }
  if (avg != null) return '${formatLocalizedNumber(avg, locale)} ${card.unit}';
  return '—';
}

/// The bar's fill.
///
/// Three states, not five: met, past a ceiling, and everything in between. A
/// nutrient merely short of its floor is an ordinary day, and painting it warm
/// turned a page of vitamins into a page of warnings.
Color nutrientFillColor(NutrientCardData card) {
  final pct = card.percentOfTarget;
  if (pct == null || isLowConfidence(card.displayState)) {
    return KalloColors.stone50;
  }
  if (shouldShowExceed(card.nutrientType, pct)) return KalloColors.offTarget;
  if (statusKeyFor(card) == StatusKey.onTarget) {
    return KalloColors.successAccent;
  }
  return KalloColors.text;
}
