/// How a nutrient reads on a card — the figure, the ONE "met" test, the bar's
/// colour, and whether it earns food-suggestion chips.
///
/// Vendored from web `components/nutrition/rows/nutrient-grid-card.tsx` (keep
/// in sync). It lives in `logic/` rather than inside the widget because the
/// green tier is a rule about nutrition, not about layout.
///
/// One definition of "met" (2026-09-07): a five-bucket status enum used to
/// live beside this file with provably identical thresholds, consumed only by
/// [nutrientFillColor] while [nutrientIsAdequate] read [isOnTarget] — two
/// spellings of one rule in one file. The enum and its colour map had no
/// other consumer and are gone; the chip gate that shared their file lives
/// here now.
library;

import 'dart:ui';

import '../../../models/nutrition/nutrition.dart';
import '../../../theme/kallo_colors.dart';
import 'helpers.dart';

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
    NutrientType.range => (pct - 100).abs() <= 10,
  };
}

/// Whether the whole card goes green: on target, and measured well enough to
/// say so. (Web also checks "not exceeded"; [isOnTarget] already implies it —
/// a ceiling is on target only inside 90..100 and exceeds only above.)
bool nutrientIsAdequate(NutrientCardData card) =>
    !isLowConfidence(card.displayState) && isOnTarget(card);

/// The card's headline figure — a PERCENTAGE, because the grid's job is
/// "how am I doing", answered at a glance across twenty cells. The absolute
/// avg/target reading sits underneath it ([nutrientGoalText]).
///
/// A value, not a string: the logic layer decides WHICH figure this is and
/// the widget spells every one of them, including the dash and the "+N%",
/// through the localisation scope. The previous shape took three label
/// callbacks and still hand-assembled two of five outputs as literals.
sealed class NutrientFigure {
  const NutrientFigure();
}

/// Nothing measured at all — an empty range, or a bucket with no reading. A
/// dash, not "limited": there is no thin reading to caveat, there is none.
class FigureUnmeasured extends NutrientFigure {
  const FigureUnmeasured();
}

class FigureLimited extends NutrientFigure {
  const FigureLimited();
}

class FigureNoTarget extends NutrientFigure {
  const FigureNoTarget();
}

/// Past a ceiling by [overBy] percent.
class FigureExceeded extends NutrientFigure {
  const FigureExceeded(this.overBy);
  final int overBy;
}

class FigurePercent extends NutrientFigure {
  const FigurePercent(this.value);
  final int value;
}

NutrientFigure nutrientFigure(NutrientCardData card) {
  final pct = card.percentOfTarget;
  if (card.averagePerDay == null && pct == null) {
    return const FigureUnmeasured();
  }
  if (card.displayState == ConfidenceDisplayState.insufficientData) {
    return const FigureLimited();
  }
  if (pct == null) return const FigureNoTarget();
  if (shouldShowExceed(card.nutrientType, pct) && pct > 100) {
    return FigureExceeded((pct - 100).round());
  }
  return FigurePercent(pct.round());
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
  if (isOnTarget(card)) return KalloColors.successAccent;
  return KalloColors.text;
}

/// Whether to surface food-source chips for a nutrient: decent confidence and
/// meaningfully below target (<90%). Every card nutrient has DB-derived
/// suggestions, so there's no per-nutrient support gate.
bool showChips(NutrientCardData card) {
  return card.confidence >= 40 &&
      card.percentOfTarget != null &&
      card.percentOfTarget! < 90;
}
