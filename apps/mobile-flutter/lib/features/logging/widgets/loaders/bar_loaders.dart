import 'package:flutter/widgets.dart';

import 'loader_math.dart';
import 'svg_loader.dart';

/// Loaders built from rounded rects whose heights walk a sampled value list.

/// Five equalizer bars, the outer pairs trailing the centre.
class BarsPainter extends LoaderPainter {
  BarsPainter(super.clock, super.color);

  static const double _dur = 1;
  static const List<double> _heights = [
    120, 110, 100, 90, 80, 70, 60, 50, 40, 140, 120,
  ];
  static const List<double> _ys = [10, 15, 20, 25, 30, 35, 40, 45, 50, 0, 10];

  /// (x, begin) — the centre bar leads, each pair out from it trailing further.
  static const List<(double, double)> _bars = [
    (0, .5),
    (30, .25),
    (60, 0),
    (90, .25),
    (120, .5),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 135;
    final sy = size.height / 140;
    final paint = Paint()..color = color;

    for (final (x, begin) in _bars) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      final rect = Rect.fromLTWH(
        x * sx,
        sampleLinear(_ys, p) * sy,
        15 * sx,
        sampleLinear(_heights, p) * sy,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, Radius.circular(6 * sx)),
        paint,
      );
    }
  }
}

/// Four bars metering off a signal — each on its own duration, so they never
/// fall into step. Bars grow upwards from the baseline.
class AudioPainter extends LoaderPainter {
  AudioPainter(super.clock, super.color);

  /// (x, duration, heights) straight from the upstream value lists.
  static const List<(double, double, List<double>)> _bars = [
    (0, 4.3, [
      20, 45, 57, 80, 64, 32, 66, 45, 64, 23, 66, 13, 64, 56, 34, 34, 2, 23,
      76, 79, 20,
    ]),
    (15, 2, [80, 55, 33, 5, 75, 23, 73, 33, 12, 14, 60, 80]),
    (30, 1.4, [50, 34, 78, 23, 56, 23, 34, 76, 80, 54, 21, 50]),
    (45, 2, [30, 45, 13, 80, 56, 72, 45, 76, 34, 23, 67, 30]),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 55;
    final sy = size.height / 80;
    final paint = Paint()..color = color;

    for (final (x, dur, heights) in _bars) {
      final h = sampleLinear(heights, loaderPhase(seconds, dur));
      // The upstream group is flipped vertically, so bars rise from the floor.
      final rect = Rect.fromLTWH(
        x * sx,
        (80 - h) * sy,
        10 * sx,
        h * sy,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, Radius.circular(3 * sx)),
        paint,
      );
    }
  }
}

const barsLoader = SvgLoaderSpec(id: 'bars', painter: BarsPainter.new);

const audioLoader = SvgLoaderSpec(
  id: 'audio',
  widthFactor: 0.6875, // 55:80
  painter: AudioPainter.new,
);
