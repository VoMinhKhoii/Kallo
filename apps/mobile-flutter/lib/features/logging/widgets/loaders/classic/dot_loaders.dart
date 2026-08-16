import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

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

const threeDotsLoader = SvgLoaderSpec(
  id: 'three-dots',
  widthFactor: 1.5,
  heightFactor: 0.375,
  painter: ThreeDotsPainter.new,
);

const gridLoader = SvgLoaderSpec(id: 'grid', painter: GridPainter.new);
