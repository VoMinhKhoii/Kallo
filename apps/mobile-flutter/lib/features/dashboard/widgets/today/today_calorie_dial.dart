/// The dock's calorie dial: the 240° arc with the day's figures in its mouth.
///
/// WHICH figure is the headline depends on the user's goal. Cutting counts
/// DOWN — what is left is the number they act on — and everyone else counts UP,
/// because a bulking or maintaining user is trying to reach a figure, not stay
/// under one. Both numbers are always on screen; only the hierarchy moves, so
/// the layout never shifts when a user changes goal.
///
/// A cutter is never shown a negative. Past target the headline reads 0 and the
/// overshoot is carried by the line underneath — the deficit is spent, and
/// "−341 remaining" is a riddle where "0" is a fact.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition_enums.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/gauge/gauge_dial.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';

/// Big enough to hold a four-figure headline in its mouth at 1.3 text scale.
const double kCalorieDialRadius = 104;

class TodayCalorieDial extends StatelessWidget {
  const TodayCalorieDial({
    required this.logged,
    required this.target,
    required this.goal,
    super.key,
  });

  final double logged;
  final double target;
  final MacroGoal? goal;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final readout = _readout((value) => formatCount(value.round(), locale));

    return GaugeDial(
      progress: target > 0 ? logged / target : 0,
      radius: kCalorieDialRadius,
      // The calorie mark's own colour, as on the ring and the week strip.
      fill: KalloColors.accent,
      primary: GaugeLine(readout.headline, dashHero()),
      secondary: GaugeLine(readout.unit, dashBody(color: kInkMuted)),
      tertiary: GaugeLine(readout.detail, dashMeta(tabular: true)),
    );
  }

  /// The three lines for this goal, decided together so each case reads as one
  /// piece rather than as three conditionals that have to agree.
  ({String headline, String unit, String detail}) _readout(
    String Function(num) fmt,
  ) {
    final remaining = (target - logged).round();

    if (goal == MacroGoal.cutting) {
      return (
        headline: fmt(math.max(0, remaining)),
        unit: tr('dashboard.kcalRemaining'),
        detail: tr(
          'dashboard.loggedOfTarget',
          namedArgs: {'logged': fmt(logged), 'target': fmt(target)},
        ),
      );
    }

    return (
      headline: fmt(logged),
      unit: tr('dashboard.caloriesLogged'),
      detail: remaining >= 0
          ? tr(
              'dashboard.leftOfTarget',
              namedArgs: {'left': fmt(remaining), 'target': fmt(target)},
            )
          : tr(
              'dashboard.overTargetBy',
              namedArgs: {'over': fmt(-remaining), 'target': fmt(target)},
            ),
    );
  }
}
