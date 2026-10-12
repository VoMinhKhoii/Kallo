import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../logic/macro_composition.dart';

/// A full ring split into a meal's macros by ENERGY share — protein, carbs,
/// fat, clockwise from 12 o'clock — with the calories in its middle.
///
/// The dashboard dial's drawing language (rounded ends, a sliver of air
/// between neighbours) closed into a circle. A meal has no target to fill
/// toward, so this ring shows what the calories are made of, not progress.
///
/// [thickness] and [gapDegrees] are the two knobs the approved canvas exposes:
/// 12 and 2° at the 128pt size the manual-log sheet draws it at.
class MacroRing extends StatelessWidget {
  const MacroRing({
    super.key,
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
    this.size = 128,
    this.thickness = 12,
    this.gapDegrees = 2,
  });

  /// Shown in the middle; null reads "—" (unknown, never 0).
  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;

  final double size;
  final double thickness;

  /// Visible air between two segments, in degrees of the ring.
  final double gapDegrees;

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams((
      protein: protein,
      carbohydrate: carbs,
      fat: fat,
    ));
    final figure = kcal == null ? '—' : kcal!.round().toString();
    return Semantics(
      label: '$figure kcal',
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: MacroRingPainter(
            segments: composition.segments,
            thickness: thickness,
            gapDegrees: gapDegrees,
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  figure,
                  maxLines: 1,
                  style: dashHero().copyWith(
                    fontSize: (size * 0.28).roundToDouble(),
                  ),
                ),
                const SizedBox(height: 4),
                Text('kcal', style: dashMeta()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints the ring. Public so its geometry can be tested without a widget.
class MacroRingPainter extends CustomPainter {
  MacroRingPainter({
    required this.segments,
    required this.thickness,
    required this.gapDegrees,
  });

  final List<CompositionSegment> segments;
  final double thickness;
  final double gapDegrees;

  /// Start and sweep (radians, canvas convention: 0 at 3 o'clock, clockwise)
  /// of each drawn segment, keyed by macro. A round cap reaches thickness/2
  /// past each end of its arc, so the ends are pulled in by that much and the
  /// air left between two caps is exactly [gapDegrees]. A segment too short to
  /// survive that is omitted; one holding the whole meal is a closed circle.
  Map<String, (double, double)> arcs(double radius) {
    final mid = radius - thickness / 2;
    final inset = (thickness / 2) / mid;
    final gap = gapDegrees * math.pi / 180;
    final out = <String, (double, double)>{};
    var at = -math.pi / 2;
    for (final segment in segments) {
      final sweep = 2 * math.pi * segment.pct / 100;
      final start = at + gap / 2 + inset;
      final end = at + sweep - gap / 2 - inset;
      if (end > start) out[segment.key] = (start, end - start);
      at += sweep;
    }
    return out;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final radius = size.shortestSide / 2;
    final center = size.center(Offset.zero);
    final rect = Rect.fromCircle(
      center: center,
      radius: radius - thickness / 2,
    );
    Paint stroke(Color color, {bool round = true}) =>
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = thickness
          ..strokeCap = round ? StrokeCap.round : StrokeCap.butt;

    final whole = segments.where((s) => s.pct >= 99.9).firstOrNull;
    if (whole != null || segments.every((s) => s.pct <= 0)) {
      // One macro is the whole meal (a spoon of oil), or nothing is known yet:
      // a closed ring with no seam rather than a single arc with a gap at 12.
      final color = whole == null ? kTrack : kCompositionColors[whole.key]!;
      canvas.drawCircle(center, rect.width / 2, stroke(color, round: false));
      return;
    }
    for (final MapEntry(key: key, value: (start, sweep))
        in arcs(radius).entries) {
      canvas.drawArc(
        rect,
        start,
        sweep,
        false,
        stroke(kCompositionColors[key]!),
      );
    }
  }

  @override
  bool shouldRepaint(MacroRingPainter oldDelegate) =>
      oldDelegate.thickness != thickness ||
      oldDelegate.gapDegrees != gapDegrees ||
      oldDelegate.segments.length != segments.length ||
      [
        for (var i = 0; i < segments.length; i++)
          segments[i].pct != oldDelegate.segments[i].pct,
      ].any((changed) => changed);
}
