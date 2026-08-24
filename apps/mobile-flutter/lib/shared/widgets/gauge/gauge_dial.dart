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

    final readout = [primary, secondary, if (tertiary != null) tertiary!];
    final readoutHeight =
        readout.fold<double>(0, (sum, line) => sum + heightOf(line)) +
        _lineGap * (readout.length - 1);

    // Where the readout wants to start for its SECOND line to land on the
    // tips.
    final wanted =
        radius +
        gaugeTipOffset(radius) -
        heightOf(secondary) / 2 -
        _lineGap -
        heightOf(primary);

    // A small dial at a large text scale wants to start ABOVE its own arc —
    // the lines are taller than the space over the tip line. Rather than clip
    // the headline or quietly break the alignment, the ARC drops by the
    // shortfall and the readout starts at 0: the two still share the tip line,
    // and the dial simply reserves the extra height.
    final arcTop = wanted < 0 ? -wanted : 0.0;
    final readoutTop = wanted + arcTop;

    // The READOUT sizes the dial, and the arc is painted behind it. The other
    // way round — a box the width of the arc, with the lines clamped into it —
    // is what the compact variant caught: at radius 52 the arc is 104 wide and
    // "kcal remaining" is 102, so the sentence filled the box edge to edge and
    // the detail under it was clipped by its own dial. A line is never narrower
    // for being cramped; only the box can give.
    return ConstrainedBox(
      constraints: BoxConstraints(
        minWidth: radius * 2,
        // The last line can hang below the arc, so the dial's own height is
        // not always the whole of it.
        minHeight: math.max(
          arcTop + gaugeHeight(radius),
          readoutTop + readoutHeight,
        ),
      ),
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          // Positioned, so it does not size the Stack — the Column below does.
          Positioned(
            top: arcTop,
            left: 0,
            right: 0,
            child: Center(
              child: RoundedGaugeArc(
                progress: progress,
                outerRadius: radius,
                fill: fill,
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(height: readoutTop),
              for (final line in readout) ...[
                if (line != readout.first) const SizedBox(height: _lineGap),
                // One line each, always: the placement above measures a single
                // line per [GaugeLine], and a wrapped one would slide every
                // line below it off the tips.
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
        ],
      ),
    );
  }
}
