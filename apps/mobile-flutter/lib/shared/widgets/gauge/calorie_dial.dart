/// The calorie dial: the 240° arc with the day's figures in its mouth.
///
/// WHICH figure leads is [calorieReadout]'s decision, not this file's — see
/// `shared/logic/calorie_readout.dart` for the goal rule and why a cutter is
/// never shown a negative. This widget's own job is the two axes of
/// PRESENTATION: the readout's framing picks the words, and the variant picks
/// how many of them there is room for.
///
/// Promoted out of the dashboard dock when the logging feed became its second
/// consumer. The two surfaces must answer "how am I doing today?" with the same
/// sentence, and re-deriving the goal rule per surface is exactly how they stop
/// agreeing.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition/nutrition_enums.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../logic/calorie_readout.dart';
import '../../logic/display_format.dart';
import 'gauge_dial.dart';

/// Big enough to hold a four-figure headline in its mouth at 1.3 text scale.
const double kCalorieDialRadius = 104;

/// The embedded size — see [CalorieDial.compact].
const double kCompactCalorieDialRadius = 52;

/// The word under the headline, per framing and per how much room there is.
///
/// A table rather than a branch: the framing and the variant are independent
/// questions, and multiplying them into conditionals is what made this
/// unreadable the first time.
const Map<CalorieFraming, ({String full, String compact})> _unitKey = {
  CalorieFraming.remaining: (
    full: 'dashboard.kcalRemaining',
    compact: 'dashboard.remainingShort',
  ),
  CalorieFraming.logged: (
    full: 'dashboard.caloriesLogged',
    compact: 'dashboard.loggedShort',
  ),
};

class CalorieDial extends StatelessWidget {
  const CalorieDial({
    required this.logged,
    required this.target,
    required this.goal,
    super.key,
  }) : radius = kCalorieDialRadius,
       _isCompact = false;

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
       _isCompact = true;

  final double logged;
  final double target;
  final MacroGoal? goal;
  final double radius;
  final bool _isCompact;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    String fmt(num value) => formatCount(value.round(), locale);

    final readout = calorieReadout(logged: logged, target: target, goal: goal);
    final fraction = {'logged': fmt(logged), 'target': fmt(target)};
    final unit = _unitKey[readout.framing]!;

    return GaugeDial(
      progress: target > 0 ? logged / target : 0,
      radius: radius,
      // The calorie mark's own colour, as on the ring and the week strip.
      fill: KalloColors.accent,
      primary: GaugeLine(
        fmt(readout.headline),
        _isCompact ? dashValue() : dashHero(),
      ),
      secondary: GaugeLine(
        tr(_isCompact ? unit.compact : unit.full),
        dashBody(color: kInkMuted),
      ),
      tertiary: GaugeLine(
        _detail(readout, fmt, fraction),
        dashMeta(tabular: true),
      ),
    );
  }

  /// The line under the arc. The compact dial's is the same fraction for every
  /// goal — the unit word above it says which of the two figures the headline
  /// is. The full dial has room to say it in words.
  String _detail(
    CalorieReadout readout,
    String Function(num) fmt,
    Map<String, String> fraction,
  ) {
    if (_isCompact) {
      return tr('dashboard.loggedOverTarget', namedArgs: fraction);
    }
    if (readout.framing == CalorieFraming.remaining) {
      return tr('dashboard.loggedOfTarget', namedArgs: fraction);
    }
    final target = fraction['target']!;
    return readout.over == null
        ? tr(
          'dashboard.leftOfTarget',
          namedArgs: {'left': fmt(readout.left), 'target': target},
        )
        : tr(
          'dashboard.overTargetBy',
          namedArgs: {'over': fmt(readout.over!), 'target': target},
        );
  }
}
