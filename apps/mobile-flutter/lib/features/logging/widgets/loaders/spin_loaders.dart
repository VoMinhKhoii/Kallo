import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'loader_math.dart';
import 'svg_loader.dart';

/// Loaders whose motion is rotation or an orbit around a centre.

/// A comet tail sweeping the dial: an arc that fades out along its own length,
/// with a bright head.
class TailSpinPainter extends LoaderPainter {
  TailSpinPainter(super.clock, super.color);

  static const double _dur = 0.9;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 38;
    final centre = Offset(19 * s, 19 * s);
    final radius = 18 * s;
    final rect = Rect.fromCircle(center: centre, radius: radius);
    final turn = loaderPhase(seconds, _dur) * 2 * math.pi;

    // The tail is a half-turn of arc whose stroke ramps from transparent at the
    // back to solid at the head — the upstream linearGradient, as a sweep.
    final shader = SweepGradient(
      startAngle: 0,
      endAngle: math.pi,
      colors: [
        color.withValues(alpha: 0),
        color.withValues(alpha: 0.631),
        color,
      ],
      stops: const [0, 0.631, 1],
      transform: GradientRotation(turn - math.pi / 2),
    ).createShader(rect);

    canvas.drawArc(
      rect,
      turn - math.pi / 2,
      math.pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4 * s
        ..shader = shader,
    );

    // The head, sitting at the bright end of the tail.
    final head = turn + math.pi / 2;
    canvas.drawCircle(
      centre + Offset(math.cos(head) * radius, math.sin(head) * radius),
      2 * s,
      Paint()..color = color,
    );
  }
}

/// Eight circles around a dial, a highlight chasing through them.
class SpinningCirclesPainter extends LoaderPainter {
  SpinningCirclesPainter(super.clock, super.color);

  static const double _dur = 1.3;
  static const int _count = 8;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 58;
    final centre = Offset(29 * s, 29 * s);
    final step = 2 * math.pi / _count;

    for (var i = 0; i < _count; i++) {
      // Each circle leads the next by one slot of the cycle.
      final p = loaderPhase(seconds, _dur, begin: -i * _dur / _count);
      final angle = -math.pi / 2 + i * step;
      canvas.drawCircle(
        centre + Offset(math.cos(angle) * 20 * s, math.sin(angle) * 20 * s),
        5 * s,
        Paint()..color = color.withValues(alpha: 1 - 0.85 * p),
      );
    }
  }
}

/// Three balls chasing each other around the corners of a triangle.
class BallTrianglePainter extends LoaderPainter {
  BallTrianglePainter(super.clock, super.color);

  static const double _dur = 2.2;

  /// The upstream cx/cy value lists — each ball walks the three corners in its
  /// own rotation and returns to where it started.
  static const List<(List<double>, List<double>)> _balls = [
    ([5, 27, 49, 5], [50, 5, 50, 50]),
    ([27, 49, 5, 27], [5, 50, 50, 5]),
    ([49, 5, 27, 49], [50, 50, 5, 50]),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 57;
    final p = loaderPhase(seconds, _dur);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2 * s
      ..color = color;

    for (final (xs, ys) in _balls) {
      canvas.drawCircle(
        Offset(sampleLinear(xs, p) * s, sampleLinear(ys, p) * s),
        5 * s,
        paint,
      );
    }
  }
}

const tailSpinLoader = SvgLoaderSpec(
  id: 'tail-spin',
  painter: TailSpinPainter.new,
);

const spinningCirclesLoader = SvgLoaderSpec(
  id: 'spinning-circles',
  painter: SpinningCirclesPainter.new,
);

const ballTriangleLoader = SvgLoaderSpec(
  id: 'ball-triangle',
  painter: BallTrianglePainter.new,
);
