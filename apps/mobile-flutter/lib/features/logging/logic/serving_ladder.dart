/// The serving-multiplier ladder shared by Scan (servings & packs) and Edit
/// Meal (Whole meal & per-dish Servings):
///
///   0.25, 1/3, 0.5, 2/3, 0.75, 1, 1.5, 2, 2.5, ...
///
/// Below 1 it hits the fractions people actually split a serving or pack into
/// (halves, thirds, quarters); from 1 upward it moves in halves. The web twin
/// is `lib/domain/meals/serving-ladder.ts` — keep the two in step.
library;

import 'package:intl/intl.dart';

/// Fractions below 1, in ascending order.
const List<double> subOneServingSteps = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

/// The lowest rung on the ladder (one quarter).
const double minServingMultiplier = 0.25;

/// Step size from 1 upward: 1, 1.5, 2, 2.5, ...
const double servingStepAboveOne = 0.5;

const double _eps = 1e-6;

/// Display tolerance for matching 1/3 and 2/3 (also catches 0.33 / 0.67 after
/// rounding to hundredths).
const double _thirdDisplayEps = 0.005;

const List<double> _subAndOneSteps = [...subOneServingSteps, 1.0];

double _stepUp(double current, {double? max}) {
  double? candidate;
  for (final rung in _subAndOneSteps) {
    if (rung > current + _eps) {
      candidate = rung;
      break;
    }
  }
  candidate ??=
      ((current / servingStepAboveOne + _eps).floorToDouble() + 1) *
      servingStepAboveOne;
  if (max != null && candidate > max + _eps) return current;
  return candidate;
}

double _stepDown(double current) {
  if (current > 1.0 + _eps) {
    return ((current / servingStepAboveOne - _eps).ceilToDouble() - 1) *
        servingStepAboveOne;
  }
  for (var i = subOneServingSteps.length - 1; i >= 0; i--) {
    final rung = subOneServingSteps[i];
    if (rung < current - _eps) return rung;
  }
  return minServingMultiplier;
}

/// Step [current] one rung up (`+1`) or down (`-1`), honoring an optional
/// upper bound [max]. Off-rung values snap to the next rung in [direction].
double stepServingMultiplier(double current, int direction, {double? max}) =>
    direction > 0 ? _stepUp(current, max: max) : _stepDown(current);

/// Whether stepping [current] in [direction] moves to another rung.
bool canStepServingMultiplier(double current, int direction, {double? max}) {
  if (direction < 0) return current > minServingMultiplier + _eps;
  return _stepUp(current, max: max) > current + _eps;
}

/// Plural category helper for serving/pack counts: sub-1 fractions and 1 read
/// singular ("0.5 serving", "1/3 pack", "1 serving"); anything above 1 reads
/// plural ("1.5 servings", "2 packs").
int servingPluralCount(double value) => value > 1.0 + _eps ? 2 : 1;

/// Format a serving count or multiplier: thirds print as `"1/3"` / `"2/3"`,
/// everything else as a locale decimal with up to two fraction digits
/// (`0.25`, `0.5`, `0.75`, `1`, `1.5` in `en`; `0,25`, `0,5`, `0,75` in `vi`).
String formatServingValue(double value, String locale) {
  if ((value - 1 / 3).abs() < _thirdDisplayEps) return '1/3';
  if ((value - 2 / 3).abs() < _thirdDisplayEps) return '2/3';
  final f = NumberFormat.decimalPattern(locale)
    ..minimumFractionDigits = 0
    ..maximumFractionDigits = 2;
  return f.format(value);
}

/// Multiplier readout for Edit Meal: `0.25×`, `1/3×`, `0.5×`, `1.5×`, `2×`.
String formatServingTimes(double value, String locale) =>
    '${formatServingValue(value, locale)}×';
