/// A gauge dial: the 240° arc with its figures nested in the mouth.
///
/// This is the gauge module's entry point — callers want a dial, not an arc
/// plus a hand-positioned readout. It owns the one alignment rule the app's
/// dials share: the SECOND line's middle sits on the arc's tips, so the type
/// and the arc read as a single object rather than a number parked near a
/// shape.
///
/// That rule is arithmetic, not a constant, because the lines grow with the
/// viewer's text scale — a fixed offset drifts off the tips at the app's 1.3
/// cap. Lines arrive as [GaugeLine] rather than as widgets so the dial can
/// measure them before it places them.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'gauge_arc_geometry.dart';
import 'rounded_gauge_arc.dart';

/// The gap between the readout's stacked lines.
const double _lineGap = 2;

/// One line of a dial's readout, with the style it will be measured at.
class GaugeLine {
  const GaugeLine(this.text, this.style);

  final String text;

  /// Must carry an explicit `fontSize`; every calm token does.
  final TextStyle style;
}

class GaugeDial extends StatelessWidget {
  const GaugeDial({
    required this.progress,
    required this.radius,
    required this.fill,
    required this.primary,
    required this.secondary,
    this.tertiary,
    super.key,
  });

  /// Consumed ÷ target. Over 1 the arc simply reads full.
  final double progress;
  final double radius;
  final Color fill;

  /// The headline figure.
  final GaugeLine primary;

  /// What the headline is — the line that lands on the arc's tips.
  final GaugeLine secondary;

  /// An optional third line, which hangs below the arc.
  final GaugeLine? tertiary;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    double heightOf(GaugeLine line) =>
        scaler.scale(line.style.fontSize!) * (line.style.height ?? 1);

    final top =
        radius +
        gaugeTipOffset(radius) -
        heightOf(secondary) / 2 -
        _lineGap -
        heightOf(primary);
    final readout = [primary, secondary, if (tertiary != null) tertiary!];
    final bottom =
        top +
        readout.fold<double>(0, (sum, line) => sum + heightOf(line)) +
        _lineGap * (readout.length - 1);

    return SizedBox(
      // The last line can hang below the arc, so the dial's own height is not
      // always the whole of it.
      height: math.max(gaugeHeight(radius), bottom),
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          RoundedGaugeArc(
            progress: progress,
            outerRadius: radius,
            fill: fill,
          ),
          Positioned(
            top: top,
            left: 0,
            right: 0,
            child: Column(
              children: [
                for (final line in readout) ...[
                  if (line != readout.first) const SizedBox(height: _lineGap),
                  // One line each, always: the placement above measures a
                  // single line per [GaugeLine], and a wrapped one would slide
                  // every line below it off the tips. A figure that outgrows
                  // the mouth overflows visibly rather than reflowing the
                  // dial — the caller picked the wrong radius, and a silent
                  // truncation would hide that behind a plausible number.
                  Text(
                    line.text,
                    style: line.style,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.visible,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
