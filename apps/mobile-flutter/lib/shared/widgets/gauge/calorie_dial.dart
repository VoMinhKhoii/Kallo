/// The calorie dial: the 240° arc with the day's figures in its mouth.
///
/// WHICH figure leads is [calorieReadout]'s decision, not this file's — see
/// `shared/logic/calorie_readout.dart` for the goal rule and why a cutter is
/// never shown a negative. This widget's own job is the two axes of
/// PRESENTATION: the readout's framing picks the words, and the variant picks
/// how many of them there is room for.
///
/// Shared by the dashboard dock and the logging feed so both answer "how am I
/// doing today?" with the same sentence.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition/nutrition_enums.dart';
import '../../../theme/kallo_colors.dart';
import '../../logic/calorie_readout.dart';
import '../../logic/display_format.dart';
import 'gauge_clear_area.dart';
import 'gauge_dial.dart';
import 'gauge_readout_line.dart';
import 'gauge_readout_type.dart';

/// Big enough to hold a four-figure headline in its mouth at 1.3 text scale.
const double kCalorieDialRadius = 104;

/// The embedded size — see [CalorieDial.compact] — when the header has room.
///
/// 58, up from 52 (2026-09-27), so the compact dial can say the full dial's
/// sentence: at 52 "Kcal còn lại" ran 1.4pt INTO the arc's tips even at 12pt;
/// at 58 it clears them by 2.5pt a side.
const double kCompactCalorieDialRadius = 58;

/// The compact dial's size on a header too narrow for 58 — the size it had
/// before the sentence, so a 320pt phone's macro dials keep what they had.
const double kCompactCalorieDialMinRadius = 52;

/// The compact radius for a dial that may take [maxWidth] — shared with the
/// header's skeleton so the placeholder is the size the dial lands at.
double compactCalorieDialRadius(double maxWidth) => (maxWidth / 2).clamp(
  kCompactCalorieDialMinRadius,
  kCompactCalorieDialRadius,
);

/// The word under the headline, per framing: the sentence ("Kcal left") when
/// the mouth holds it, the one word ("Left") when it does not.
///
/// A table rather than a branch: the framing and the wording are independent
/// questions, and multiplying them into conditionals is what made this
/// unreadable the first time. Same shape as the web dial's `UNIT_KEY`.
const Map<CalorieFraming, ({String long, String short})> _unitKey = {
  CalorieFraming.remaining: (
    long: 'dashboard.kcalRemaining',
    short: 'dashboard.remainingShort',
  ),
  CalorieFraming.logged: (
    long: 'dashboard.caloriesLogged',
    short: 'dashboard.loggedShort',
  ),
};

class CalorieDial extends StatelessWidget {
  const CalorieDial({
    required this.logged,
    required this.target,
    required this.goal,
    this.atLeast = false,
    super.key,
  }) : radius = kCalorieDialRadius,
       maxWidth = null,
       _isCompact = false;

  /// The variant for a surface that draws the dial inside a fixed header above
  /// a scrolling day, rather than giving it the top of the screen.
  ///
  /// A smaller radius, the headline steps from Hero 40 to Figure 17, and the
  /// unit steps to 12 ([gaugeCompactUnit]) so the full dial's sentence still
  /// fits the mouth. Where it does not — a large text scale — the unit falls
  /// back to one word rather than crossing the arc (see [_unit]).
  ///
  /// The detail keeps its verb when the headline counts DOWN: a bare
  /// "918/1.932" under "còn lại" read as "918 of 1.932 left" on device
  /// (2026-09-27). Counting UP the fraction leads with the headline figure,
  /// as the macro dials' do, so it stays bare.
  ///
  /// [maxWidth] is what the surface can spare beside its macro dials; the dial
  /// shrinks toward [kCompactCalorieDialMinRadius] and drops the verb before
  /// taking more (at 320pt/1.3x the verb line squeezed the macro figures away,
  /// review of #396). Without it the dial keeps to its own arc's width.
  const CalorieDial.compact({
    required this.logged,
    required this.target,
    required this.goal,
    this.atLeast = false,
    this.maxWidth,
    super.key,
  }) : radius = kCompactCalorieDialRadius,
       _isCompact = true;

  final double logged;
  final double target;
  final MacroGoal? goal;
  final bool atLeast; // the logged total is a floor: a meal's kcal unknown
  final double radius;
  final double? maxWidth;
  final bool _isCompact;

  /// The radius this build draws at — see [maxWidth].
  double get _radius {
    final room = maxWidth;
    if (!_isCompact || room == null) return radius;
    return compactCalorieDialRadius(room);
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    String fmt(num value) => formatCount(value.round(), locale);
    // A floor on what was eaten (or over) is a ceiling on what is left.
    String eaten(num value) => '${atLeast ? '≥' : ''}${fmt(value)}';
    String left(num value) => '${atLeast ? '≤' : ''}${fmt(value)}';

    final readout = calorieReadout(logged: logged, target: target, goal: goal);
    final fraction = {'logged': eaten(logged), 'target': fmt(target)};
    final radius = _radius;

    return GaugeDial(
      progress: target > 0 ? logged / target : 0,
      radius: radius,
      fill: KalloColors.accent, // the calorie mark's own colour
      // Headline and unit step down when compact; the fraction never does.
      primary: GaugeLine(
        (readout.framing == CalorieFraming.logged ? eaten : left)(
          readout.headline,
        ),
        _isCompact ? gaugeFigure() : gaugeHeroFigure(),
      ),
      secondary: _unit(context, readout.framing, radius),
      tertiary: GaugeLine(
        _detail(context, readout, (eaten: eaten, left: left), fraction, radius),
        gaugeDenominator(),
      ),
    );
  }

  /// The line on the arc's tips: the sentence, or — compact, measured at the
  /// viewer's text scale — the one word when the sentence would not clear.
  GaugeLine _unit(BuildContext context, CalorieFraming framing, double radius) {
    final key = _unitKey[framing]!;
    if (!_isCompact) return GaugeLine(tr(key.long), gaugeUnit());

    final long = GaugeLine(tr(key.long), gaugeCompactUnit());
    final style = long.style;
    final fits = gaugeTipLineFits(
      radius,
      width: gaugeLineWidth(context, long),
      height:
          MediaQuery.textScalerOf(context).scale(style.fontSize!) *
          style.height!,
    );
    return fits ? long : GaugeLine(tr(key.short), style);
  }

  /// The line under the arc: the OTHER figure, with a verb whenever it is not
  /// the headline's own. The compact dial drops the verb when counting up (the
  /// fraction leads with the headline) or when it would widen the dial.
  String _detail(
    BuildContext context,
    CalorieReadout readout,
    ({String Function(num) eaten, String Function(num) left}) fmt,
    Map<String, String> fraction,
    double radius,
  ) {
    final bare = tr('dashboard.loggedOverTarget', namedArgs: fraction);
    if (readout.framing == CalorieFraming.remaining) {
      final verb = tr('dashboard.loggedOfTarget', namedArgs: fraction);
      if (!_isCompact) return verb;
      final room = math.max(maxWidth ?? 0, radius * 2);
      final width = gaugeLineWidth(
        context,
        GaugeLine(verb, gaugeDenominator()),
      );
      return width <= room ? verb : bare;
    }
    if (_isCompact) return bare;
    final target = fraction['target']!;
    return readout.over == null
        ? tr(
          'dashboard.leftOfTarget',
          namedArgs: {'left': fmt.left(readout.left), 'target': target},
        )
        : tr(
          'dashboard.overTargetBy',
          namedArgs: {'over': fmt.eaten(readout.over!), 'target': target},
        );
  }
}
