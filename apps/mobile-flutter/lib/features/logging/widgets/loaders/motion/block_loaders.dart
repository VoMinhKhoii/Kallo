import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Loaders built from rectangles that turn or climb.

/// Three squares turning over in sequence, each edge-on at its midpoint.
class FlipSquaresPainter extends LoaderPainter {
  FlipSquaresPainter(super.clock, super.color);

  static const double _dur = 1.5;
  static const List<double> _x = [8, 20, 32];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final paint = Paint()..color = color;

    for (var i = 0; i < _x.length; i++) {
      // Each square gets its own third of the cycle to turn in.
      final p = loaderPhase(seconds, _dur, begin: -i * _dur / 6);
      // Turn over the first half, rest the second.
      final turn = p < 0.5 ? Curves.easeInOut.transform(p / 0.5) : 1.0;
      final w = math.cos(turn * math.pi).abs().clamp(0.06, 1.0);

      canvas.save();
      canvas.translate(_x[i] * s, 20 * s);
      canvas.scale(w, 1);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: 9 * s, height: 9 * s),
          Radius.circular(2.2 * s),
        ),
        paint,
      );
      canvas.restore();
    }
  }
}

/// Blocks climbing a staircase — one steps up as the last steps down.
class LadderPainter extends LoaderPainter {
  LadderPainter(super.clock, super.color);

  static const double _dur = 1.2;
  static const int _count = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final paint = Paint()..color = color;

    for (var i = 0; i < _count; i++) {
      final p = loaderPhase(seconds, _dur, begin: -i * _dur / _count);
      // Up fast, hold, down slow: a step rather than a bob.
      final lift = p < 0.3
          ? Curves.easeOut.transform(p / 0.3)
          : (p < 0.7 ? 1.0 : 1 - Curves.easeIn.transform((p - 0.7) / 0.3));

      final h = 8 + 14 * lift;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            (5 + i * 8.5) * s,
            (30 - h) * s,
            6 * s,
            h * s,
          ),
          Radius.circular(2.4 * s),
        ),
        paint..color = color.withValues(alpha: 0.45 + 0.55 * lift),
      );
    }
  }
}

const flipSquaresLoader = SvgLoaderSpec(
  id: 'flip-squares',
  painter: FlipSquaresPainter.new,
);

const ladderLoader = SvgLoaderSpec(id: 'ladder', painter: LadderPainter.new);
