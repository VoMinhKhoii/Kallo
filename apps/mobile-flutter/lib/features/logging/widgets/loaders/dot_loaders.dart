import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'loader_math.dart';
import 'svg_loader.dart';

/// Loaders built from circles on a fixed lattice, varying radius or opacity.

/// Three dots pulsing in radius and opacity. Wider than tall (4:1 viewBox), so
/// it renders short and wide to hold its own beside the square loaders.
class ThreeDotsPainter extends LoaderPainter {
  ThreeDotsPainter(super.clock, super.color);

  static const double _dur = 0.8;
  static const List<double> _rOuter = [15, 9, 15];
  static const List<double> _rInner = [9, 15, 9];
  static const List<double> _oOuter = [1, .5, 1];
  static const List<double> _oInner = [.5, 1, .5];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 120;
    final p = loaderPhase(seconds, _dur);

    void dot(double cx, List<double> radii, List<double> opacities) {
      canvas.drawCircle(
        Offset(cx * s, 15 * s),
        sampleLinear(radii, p) * s,
        Paint()..color = color.withValues(alpha: sampleLinear(opacities, p)),
      );
    }

    dot(15, _rOuter, _oOuter);
    dot(60, _rInner, _oInner);
    dot(105, _rOuter, _oOuter);
  }
}

/// A 3x3 grid of twinkling dots.
class GridPainter extends LoaderPainter {
  GridPainter(super.clock, super.color);

  static const double _dur = 1;
  static const List<double> _opacity = [1, .2, 1];

  /// (cx, cy, begin) — the upstream stagger, which is deliberately not a
  /// left-to-right sweep.
  static const List<(double, double, double)> _dots = [
    (12.5, 12.5, 0),
    (12.5, 52.5, .1),
    (52.5, 12.5, .3),
    (52.5, 52.5, .6),
    (92.5, 12.5, .8),
    (92.5, 52.5, .4),
    (12.5, 92.5, .7),
    (52.5, 92.5, .5),
    (92.5, 92.5, .2),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 105;
    for (final (cx, cy, begin) in _dots) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      canvas.drawCircle(
        Offset(cx * s, cy * s),
        12.5 * s,
        Paint()..color = color.withValues(alpha: sampleLinear(_opacity, p)),
      );
    }
  }
}

/// Two counter-rotating rings of dots: four inside turning one way, eight
/// outside turning the other, much slower.
class CirclesPainter extends LoaderPainter {
  CirclesPainter(super.clock, super.color);

  static const double _innerDur = 2.5;
  static const double _outerDur = 8;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 135;
    final centre = Offset(67 * s, 67 * s);
    final paint = Paint()..color = color;

    void ring({
      required int count,
      required double radius,
      required double dotRadius,
      required double turns,
      required double startAngle,
    }) {
      final step = 2 * math.pi / count;
      for (var i = 0; i < count; i++) {
        final angle = startAngle + turns * 2 * math.pi + i * step;
        canvas.drawCircle(
          centre +
              Offset(math.cos(angle) * radius * s, math.sin(angle) * radius * s),
          dotRadius * s,
          paint,
        );
      }
    }

    // Inner: four dots, anticlockwise.
    ring(
      count: 4,
      radius: 19.45,
      dotRadius: 10,
      turns: -loaderPhase(seconds, _innerDur),
      startAngle: -math.pi / 2,
    );
    // Outer: eight dots, clockwise and far slower.
    ring(
      count: 8,
      radius: 55,
      dotRadius: 12,
      turns: loaderPhase(seconds, _outerDur),
      startAngle: -math.pi / 2,
    );
  }
}

const threeDotsLoader = SvgLoaderSpec(
  id: 'three-dots',
  widthFactor: 1.5,
  heightFactor: 0.375,
  painter: ThreeDotsPainter.new,
);

const gridLoader = SvgLoaderSpec(id: 'grid', painter: GridPainter.new);

const circlesLoader = SvgLoaderSpec(id: 'circles', painter: CirclesPainter.new);
