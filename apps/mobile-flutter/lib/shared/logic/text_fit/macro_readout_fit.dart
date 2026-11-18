import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import '../macro_composition.dart';
import '../../widgets/gauge/gauge_arc_geometry.dart';
import '../../widgets/gauge/gauge_clear_area.dart';
import '../../widgets/gauge/gauge_dial.dart';
import '../../widgets/gauge/gauge_readout_line.dart';
import '../../widgets/gauge/gauge_readout_type.dart';

/// Fits every compact macro readout to the same clear area inside its arc.
double macroReadoutFit(
  BuildContext context, {
  required double radius,
  required Map<String, int> current,
  required Map<String, int> target,
  required Set<String> atLeast,
}) {
  var fit = 1.0;
  final scaler = MediaQuery.textScalerOf(context);
  final primaryStyle = gaugeCompactFigure();
  final secondaryStyle = gaugeDenominator();
  final h1 = scaler.scale(primaryStyle.fontSize!) * (primaryStyle.height ?? 1);
  final h2 =
      scaler.scale(secondaryStyle.fontSize!) * (secondaryStyle.height ?? 1);
  final tip = gaugeTipOffset(radius);
  for (final key in kCompositionKeys) {
    final lines = [
      GaugeLine(
        '${atLeast.contains(key) ? '≥' : ''}${current[key] ?? 0}g',
        primaryStyle,
      ),
      GaugeLine('/${target[key] ?? 0}g', secondaryStyle),
    ];
    for (var i = 0; i < 2; i++) {
      final top = i == 0 ? tip - h2 / 2 - 2 - h1 : tip - h2 / 2;
      final width =
          2 * gaugeClearHalfWidthForBand(radius, top, top + (i == 0 ? h1 : h2));
      final wanted = gaugeLineWidth(context, lines[i]);
      if (wanted > width) {
        fit = math.min(
          fit,
          math.max(0, width - 2 * kGaugeReadoutClearMargin) / wanted,
        );
      }
    }
  }

  return fit;
}
