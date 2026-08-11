import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'loader_math.dart';
import 'svg_loader.dart';

/// Loaders built from concentric stroked circles — expanding, fading, or a
/// dial with a rotating arc.

/// Two rings puffing outwards and fading, offset half a cycle apart.
class PuffPainter extends LoaderPainter {
  PuffPainter(super.clock, super.color);

  static const double _dur = 1.8;
  static const Cubic _radiusEase = Cubic(0.165, 0.84, 0.44, 1);
  static const Cubic _fadeEase = Cubic(0.3, 0.61, 0.355, 1);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 44;
    final centre = Offset(22 * s, 22 * s);

    for (final begin in const [0.0, -0.9]) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      canvas.drawCircle(
        centre,
        sampleSpline(1, 20, p, _radiusEase) * s,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3 * s
          ..color = color.withValues(
            alpha: sampleSpline(1, 0, p, _fadeEase).clamp(0.0, 1.0),
          ),
      );
    }
  }
}

/// Two rings expanding out of a pulsing core, their stroke thinning to nothing
/// as they go.
class RingsPainter extends LoaderPainter {
  RingsPainter(super.clock, super.color);

  static const double _rippleDur = 3;
  static const double _coreDur = 1.5;
  static const List<double> _coreRadii = [6, 1, 2, 3, 4, 5, 6];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 45;
    // The upstream group is translate(1 1) inside a 45-unit box.
    final centre = Offset(23 * s, 23 * s);

    for (final begin in const [1.5, 3.0]) {
      final p = loaderPhase(seconds, _rippleDur, begin: begin);
      final strokeWidth = (2 - 2 * p) * s;
      if (strokeWidth <= 0) continue;
      canvas.drawCircle(
        centre,
        (6 + 16 * p) * s,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..color = color.withValues(alpha: (1 - p).clamp(0.0, 1.0)),
      );
    }

    canvas.drawCircle(
      centre,
      sampleLinear(_coreRadii, loaderPhase(seconds, _coreDur)) * s,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * s
        ..color = color,
    );
  }
}

/// A faint dial with one quarter-arc rotating around it.
class OvalPainter extends LoaderPainter {
  OvalPainter(super.clock, super.color);

  static const double _dur = 1;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 38;
    // translate(1 1), r 18 — the dial's centre sits at 19 in the 38-unit box.
    final centre = Offset(19 * s, 19 * s);
    final rect = Rect.fromCircle(center: centre, radius: 18 * s);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4 * s;

    canvas.drawCircle(
      centre,
      18 * s,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4 * s
        ..color = color.withValues(alpha: 0.4),
    );

    // The upstream path runs from 3 o'clock anticlockwise to 12 o'clock.
    final turn = loaderPhase(seconds, _dur) * 2 * math.pi;
    canvas.drawArc(rect, turn - math.pi / 2, math.pi / 2, false,
        stroke..color = color);
  }
}

const puffLoader = SvgLoaderSpec(id: 'puff', painter: PuffPainter.new);

const ringsLoader = SvgLoaderSpec(id: 'rings', painter: RingsPainter.new);

const ovalLoader = SvgLoaderSpec(id: 'oval', painter: OvalPainter.new);
