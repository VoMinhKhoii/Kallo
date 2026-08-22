/// The calorie dial: the 240° arc with the day's figures in its mouth.
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
///
/// Promoted out of the dashboard dock when the logging feed became its second
/// consumer. The two surfaces must answer "how am I doing today?" with the same
/// sentence, and re-deriving the goal rule per surface is exactly how they stop
/// agreeing.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition/nutrition_enums.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../logic/display_format.dart';
import 'gauge_dial.dart';

/// Big enough to hold a four-figure headline in its mouth at 1.3 text scale.
const double kCalorieDialRadius = 104;

/// The embedded size — see [CalorieDial.compact].
const double kCompactCalorieDialRadius = 52;

class CalorieDial extends StatelessWidget {
  const CalorieDial({
    required this.logged,
    required this.target,
    required this.goal,
    super.key,
  }) : radius = kCalorieDialRadius,
       _headlineIsHero = true;

  /// The variant for a surface that draws the dial inside a fixed header above
  /// a scrolling day, rather than giving it the top of the screen.
  ///
  /// Half the radius, the headline steps from Hero 40 to Value 17, and both
  /// lower lines shorten. The radius forces that: on the tip line the mouth is
  /// only ~0.56× the radius each side, so at 52 it holds ~58pt, and the dock's
  /// "kcal remaining" measures 102. The unit becomes one word, and the detail
  /// drops to the bare fraction — figures and a slash, which every locale
  /// renders at the same width, so a long translation cannot push the macro
  /// dials beside it out of shape.
  ///
  /// This is the calorie ring's own composition, which this dial replaced: the
  /// figure and a one-word label inside the mark, the day's arithmetic under
  /// it.
  const CalorieDial.compact({
    required this.logged,
    required this.target,
    required this.goal,
    super.key,
  }) : radius = kCompactCalorieDialRadius,
       _headlineIsHero = false;

  final double logged;
  final double target;
  final MacroGoal? goal;
  final double radius;
  final bool _headlineIsHero;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final readout = _readout((value) => formatCount(value.round(), locale));

    return GaugeDial(
      progress: target > 0 ? logged / target : 0,
      radius: radius,
      // The calorie mark's own colour, as on the ring and the week strip.
      fill: KalloColors.accent,
      primary: GaugeLine(
        readout.headline,
        _headlineIsHero ? dashHero() : dashValue(),
      ),
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

    // The compact dial's detail is the same fraction for every goal — the unit
    // word above it says which of the two figures the headline is.
    final progress = tr(
      'dashboard.loggedOverTarget',
      namedArgs: {'logged': fmt(logged), 'target': fmt(target)},
    );

    if (goal == MacroGoal.cutting) {
      return (
        headline: fmt(math.max(0, remaining)),
        unit: _headlineIsHero
            ? tr('dashboard.kcalRemaining')
            : tr('dashboard.remainingShort'),
        detail: _headlineIsHero
            ? tr(
                'dashboard.loggedOfTarget',
                namedArgs: {'logged': fmt(logged), 'target': fmt(target)},
              )
            : progress,
      );
    }

    return (
      headline: fmt(logged),
      unit: _headlineIsHero
          ? tr('dashboard.caloriesLogged')
          : tr('dashboard.loggedShort'),
      detail: !_headlineIsHero
          ? progress
          : remaining >= 0
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
