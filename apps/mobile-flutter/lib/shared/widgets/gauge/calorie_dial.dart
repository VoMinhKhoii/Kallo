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
import '../../../theme/kallo_colors.dart';
import '../../logic/calorie_readout.dart';
import '../../logic/display_format.dart';
import 'gauge_clear_area.dart';
import 'gauge_dial.dart';
import 'gauge_readout_type.dart';

/// Big enough to hold a four-figure headline in its mouth at 1.3 text scale.
const double kCalorieDialRadius = 104;

/// The embedded size — see [CalorieDial.compact].
///
/// 58, up from 52 (2026-09-27), so the compact dial can say the full dial's
/// sentence: at 52 "Kcal còn lại" ran 1.4pt INTO the arc's tips even at 12pt;
/// at 58 it clears them by 2.5pt a side. The six points come out of the macro
/// columns, which still hold "CHẤT BÉO" in full at 1.0x.
const double kCompactCalorieDialRadius = 58;

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
    super.key,
  }) : radius = kCalorieDialRadius,
       _isCompact = false;

  /// The variant for a surface that draws the dial inside a fixed header above
  /// a scrolling day, rather than giving it the top of the screen.
  ///
  /// A smaller radius, the headline steps from Hero 40 to Figure 17, and the
  /// unit steps to 12 ([gaugeCompactUnit]) so the full dial's sentence still
  /// fits the mouth. Where it does not — a large text scale — the unit falls
  /// back to one word rather than crossing the arc (see [_unit]).
  ///
  /// The detail keeps its verb when the headline counts DOWN. The bare
  /// "918/1.932" under "còn lại" read as "918 of 1.932 left" on device
  /// (2026-09-27): a grey fraction with no word of its own borrowed the unit
  /// above it. "Đã ghi 918/1.932" cannot be misread that way. Counting UP the
  /// fraction starts with the headline figure, as the macro dials' do, so it
  /// stays bare.
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

    return GaugeDial(
      progress: target > 0 ? logged / target : 0,
      radius: radius,
      // The calorie mark's own colour, as on the ring and the week strip.
      fill: KalloColors.accent,
      // The headline and the unit step down in the compact variant; the
      // fraction under the arc is the same size in both — the dial's own type,
      // sized by the arc rather than by the reading ramp (see
      // [gaugeDenominator]).
      primary: GaugeLine(
        fmt(readout.headline),
        _isCompact ? gaugeFigure() : gaugeHeroFigure(),
      ),
      secondary: _unit(context, readout.framing),
      tertiary: GaugeLine(_detail(readout, fmt, fraction), gaugeDenominator()),
    );
  }

  /// The line on the arc's tips. The full dial always says the sentence; the
  /// compact one measures it at the viewer's text scale first and says the one
  /// word when the sentence would not clear the tips.
  GaugeLine _unit(BuildContext context, CalorieFraming framing) {
    final key = _unitKey[framing]!;
    if (!_isCompact) return GaugeLine(tr(key.long), gaugeUnit());

    final style = gaugeCompactUnit();
    final scaler = MediaQuery.textScalerOf(context);
    final long = tr(key.long);
    final painter = TextPainter(
      text: TextSpan(text: long, style: style),
      textDirection: Directionality.of(context),
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    final fits = gaugeTipLineFits(
      radius,
      width: painter.width,
      height: scaler.scale(style.fontSize!) * style.height!,
    );
    painter.dispose();
    return GaugeLine(fits ? long : tr(key.short), style);
  }

  /// The line under the arc: the OTHER figure, with a verb whenever it is not
  /// the headline's own. The compact dial drops the verb only when counting
  /// up, where the fraction already leads with the headline figure.
  String _detail(
    CalorieReadout readout,
    String Function(num) fmt,
    Map<String, String> fraction,
  ) {
    if (readout.framing == CalorieFraming.remaining) {
      return tr('dashboard.loggedOfTarget', namedArgs: fraction);
    }
    if (_isCompact) {
      return tr('dashboard.loggedOverTarget', namedArgs: fraction);
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
