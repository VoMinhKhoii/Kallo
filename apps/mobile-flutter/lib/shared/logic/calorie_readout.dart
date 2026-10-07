/// What the day's calorie figure says, decided from the user's goal alone.
///
/// WHICH figure is the headline depends on the goal. Cutting counts DOWN —
/// what is left is the number they act on — and everyone else counts UP,
/// because a bulking or maintaining user is trying to reach a figure, not stay
/// under one. Both numbers are always available to the caller; only the
/// hierarchy moves, so a dial drawn from this never shifts its layout when a
/// user changes goal.
///
/// A cutter is never shown a negative: past target the headline reads 0 and the
/// overshoot is carried by [CalorieReadout.over]. The deficit is spent, and
/// "−341 remaining" is a riddle where "0" is a fact.
///
/// Pure, and deliberately free of copy: this is the RULE, and how wordy a
/// surface renders it is that surface's business. Web counterpart:
/// `lib/domain/nutrition/calorie-readout.ts` (keep in sync).
library;

import 'dart:math' as math;

import '../../models/nutrition/nutrition_enums.dart';

/// Which of the day's two figures the headline is.
enum CalorieFraming { remaining, logged }

class CalorieReadout {
  const CalorieReadout({
    required this.headline,
    required this.framing,
    required this.left,
    required this.over,
  });

  /// The figure to lead with, never negative.
  final int headline;
  final CalorieFraming framing;

  /// The other figure: what is left to spend, floored at 0.
  final int left;

  /// How far past target, or null while the day is still under it.
  final int? over;
}

CalorieReadout calorieReadout({
  required double logged,
  required double target,
  required MacroGoal? goal,
}) {
  final remaining = (target - logged).round();
  final left = math.max(0, remaining);
  final countsDown = goal == MacroGoal.cutting;

  return CalorieReadout(
    headline: countsDown ? left : logged.round(),
    framing: countsDown ? CalorieFraming.remaining : CalorieFraming.logged,
    left: left,
    over: remaining < 0 ? -remaining : null,
  );
}
