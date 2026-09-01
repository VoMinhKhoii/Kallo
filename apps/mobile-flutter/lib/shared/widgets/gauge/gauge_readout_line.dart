/// One line of a [GaugeDial]'s readout, optionally held inside the dial's own
/// clear area.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'gauge_clear_area.dart';
import 'gauge_dial.dart';

/// One readout line, optionally held inside [maxWidth].
///
/// Taken IN rather than clipped or ellipsised: a clipped `1047g` renders as
/// `1047` or `104` — a different figure, not visibly truncated — which is the
/// same trap [MacroKcal] exists to avoid on the meal rows.
class GaugeReadoutLine extends StatelessWidget {
  const GaugeReadoutLine({
    required this.line,
    required this.height,
    this.maxWidth,
    super.key,
  });

  final GaugeLine line;

  /// The slot's height — the same figure the dial's placement maths used.
  final double height;

  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final text = Text(
      line.text,
      style: line.style,
      maxLines: 1,
      softWrap: false,
      overflow: TextOverflow.visible,
    );
    final width = maxWidth;
    if (width == null) return text;

    // How wide the figure WANTS to be, at the scale it will actually render.
    final painter = TextPainter(
      text: TextSpan(text: line.text, style: line.style),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();

    // A figure that already fits inside the ring keeps its size — the clear
    // area over-reserves against the ink (the line box carries side bearings
    // and, on the tabular styles, a full digit advance either end), so one
    // that merely fits still clears the stroke by several points.
    //
    // A figure that does NOT fit was going to be taken in regardless, and that
    // is where a bound with no margin bites: it shrinks the figure to exactly
    // the chord, landing the ink ON the pigment. Those lines — four digits, or
    // a large text scale — pay [kGaugeReadoutClearMargin] on each side so the
    // gap is real rather than nominal.
    //
    // Charging the margin unconditionally is what this avoids: it would take
    // the compact dial's three-digit `202g` from its 14pt ramp size down to an
    // effective ~10.9pt, which is the "goals too small" regression again.
    final bound = painter.width <= width
        ? width
        : math.max(0.0, width - 2 * kGaugeReadoutClearMargin);

    // The slot keeps its FULL height whatever the figure inside it does. A
    // bare `FittedBox` shrinks its child in both directions, so a taken-in
    // line got shorter as well as narrower — which slid it up off the arc
    // tips and broke the one alignment this dial guarantees ("the secondary
    // line and the arc tips share one line"). Only the WIDTH gives.
    return SizedBox(
      height: height,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: bound),
        child: FittedBox(fit: BoxFit.scaleDown, child: text),
      ),
    );
  }
}
