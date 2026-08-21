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
import '../../../../shared/widgets/gauge/rounded_gauge_arc.dart';
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
    final remaining = (target - logged).round();
    final overTarget = remaining < 0;
    final countsDown = goal == MacroGoal.cutting;

    String fmt(num value) => formatCount(value.round(), locale);

    // Cutting: what is LEFT, floored at zero. Otherwise: what has been EATEN.
    final headline = countsDown && !overTarget
        ? fmt(remaining)
        : countsDown
        ? fmt(0)
        : fmt(logged);
    final unit = countsDown
        ? tr('dashboard.kcalRemaining')
        : tr('dashboard.caloriesLogged');
    final detail = countsDown
        ? tr(
            'dashboard.loggedOfTarget',
            namedArgs: {'logged': fmt(logged), 'target': fmt(target)},
          )
        : overTarget
        ? tr(
            'dashboard.overTargetBy',
            namedArgs: {'over': fmt(-remaining), 'target': fmt(target)},
          )
        : tr(
            'dashboard.leftOfTarget',
            namedArgs: {'left': fmt(remaining), 'target': fmt(target)},
          );

    final headlineStyle = dashHero();
    final unitStyle = dashBody(color: kInkMuted);
    final scaler = MediaQuery.textScalerOf(context);

    return SizedBox(
      height: _stackHeight(headlineStyle, unitStyle, scaler),
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          RoundedGaugeArc(
            progress: target > 0 ? logged / target : 0,
            outerRadius: kCalorieDialRadius,
            // The calorie mark's own colour, as on the ring and the week strip.
            fill: KalloColors.accent,
          ),
          Positioned(
            top: readoutTopFor(
              outerRadius: kCalorieDialRadius,
              primaryHeight: gaugeLineHeight(headlineStyle, scaler),
              secondaryHeight: gaugeLineHeight(unitStyle, scaler),
            ),
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(headline, style: headlineStyle),
                const SizedBox(height: kGaugeReadoutGap),
                Text(unit, style: unitStyle),
                const SizedBox(height: kGaugeReadoutGap),
                Text(detail, style: dashMeta(tabular: true)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The readout's last line hangs below the arc, so the dial's own height is
  /// not the whole of it.
  double _stackHeight(
    TextStyle headline,
    TextStyle unit,
    TextScaler scaler,
  ) {
    final detailHeight = gaugeLineHeight(dashMeta(), scaler);
    final readoutBottom =
        readoutTopFor(
          outerRadius: kCalorieDialRadius,
          primaryHeight: gaugeLineHeight(headline, scaler),
          secondaryHeight: gaugeLineHeight(unit, scaler),
        ) +
        gaugeLineHeight(headline, scaler) +
        gaugeLineHeight(unit, scaler) +
        detailHeight +
        kGaugeReadoutGap * 2;
    return math.max(gaugeHeight(kCalorieDialRadius), readoutBottom);
  }
}
