/// One line of a [GaugeDial]'s readout, optionally held inside the dial's own
/// clear area.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

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

    // The slot keeps its FULL height whatever the figure inside it does. A
    // bare `FittedBox` shrinks its child in both directions, so a taken-in
    // line got shorter as well as narrower — which slid it up off the arc
    // tips and broke the one alignment this dial guarantees ("the secondary
    // line and the arc tips share one line"). Only the WIDTH gives.
    return SizedBox(
      height: height,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: math.max(width, 0)),
        child: FittedBox(fit: BoxFit.scaleDown, child: text),
      ),
    );
  }
}
