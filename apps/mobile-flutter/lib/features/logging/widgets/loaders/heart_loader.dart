import 'package:flutter/widgets.dart';

import 'loader_math.dart';
import 'svg_loader.dart';

/// Three hearts breathing in and out of step. The only path-based loader.
class HeartsPainter extends LoaderPainter {
  HeartsPainter(super.clock, super.color);

  static const double _dur = 1.4;
  static const List<double> _opacity = [0.5, 1, 0.5];

  /// (centre x, begin) in the 140x64 viewBox — the middle heart is deliberately
  /// NOT the middle of the stagger.
  static const List<(double, double)> _hearts = [
    (28, 0),
    (65, 0.3),
    (102, 0.7),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 140;
    final sy = size.height / 64;

    for (final (cx, begin) in _hearts) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      canvas.drawPath(
        _heartPath(Rect.fromLTWH(
          (cx - 25) * sx,
          8 * sy,
          50 * sx,
          48 * sy,
        )),
        Paint()..color = color.withValues(alpha: sampleLinear(_opacity, p)),
      );
    }
  }

  /// A heart inscribed in [r]: two lobes meeting at a dimple on the top edge,
  /// their outer walls sweeping down to the point.
  static Path _heartPath(Rect r) {
    final w = r.width;
    final h = r.height;
    final dimple = Offset(r.center.dx, r.top + h * 0.28);
    final tip = Offset(r.center.dx, r.bottom);

    return Path()
      ..moveTo(dimple.dx, dimple.dy)
      // Left lobe, then down the left wall to the tip.
      ..cubicTo(
        r.left + w * 0.42, r.top,
        r.left, r.top + h * 0.05,
        r.left, r.top + h * 0.35,
      )
      ..cubicTo(
        r.left, r.top + h * 0.62,
        r.left + w * 0.28, r.top + h * 0.78,
        tip.dx, tip.dy,
      )
      // Right wall back up, then the right lobe home.
      ..cubicTo(
        r.right - w * 0.28, r.top + h * 0.78,
        r.right, r.top + h * 0.62,
        r.right, r.top + h * 0.35,
      )
      ..cubicTo(
        r.right, r.top + h * 0.05,
        r.right - w * 0.42, r.top,
        dimple.dx, dimple.dy,
      )
      ..close();
  }
}

const heartsLoader = SvgLoaderSpec(
  id: 'hearts',
  widthFactor: 1.09375, // 140:64, drawn at half height
  heightFactor: 0.5,
  painter: HeartsPainter.new,
);
