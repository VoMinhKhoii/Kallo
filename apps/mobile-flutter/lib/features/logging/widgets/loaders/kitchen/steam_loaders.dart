import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Loaders that read as something hot: steam off a bowl, and a simmer.

/// Three wisps of steam rising and thinning out — the phở-bowl loader.
class SteamPainter extends LoaderPainter {
  SteamPainter(super.clock, super.color);

  static const double _dur = 2.4;

  /// (x in a 40-wide box, begin) — offset so the wisps never rise in step.
  static const List<(double, double)> _wisps = [
    (11, 0),
    (20, -0.8),
    (29, -1.6),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * s
      ..strokeCap = StrokeCap.round;

    // The rim it comes off, so the wisps read as steam and not as squiggles.
    canvas.drawArc(
      Rect.fromCenter(center: Offset(20 * s, 33 * s), width: 24 * s, height: 12 * s),
      0,
      math.pi,
      false,
      paint..color = color,
    );

    for (final (x, begin) in _wisps) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      // A wisp 14 tall that climbs 16 and fades as it goes.
      final base = 29 - 16 * p;
      final path = Path()..moveTo(x * s, base * s);
      // A full S over its own length — one crossing each way, which is what
      // makes it read as steam rather than as a wavy line.
      for (var t = 0.05; t <= 1.0; t += 0.05) {
        final dx = math.sin(t * 2 * math.pi) * 3.2 * s;
        path.lineTo(x * s + dx, (base - 14 * t) * s);
      }
      // Fade in off the rim, out at the top — never a hard pop at either end.
      final alpha = (p < 0.2 ? p / 0.2 : (1 - p) / 0.8).clamp(0.0, 1.0);
      canvas.drawPath(
        path,
        paint
          ..color = color.withValues(alpha: alpha * 0.9)
          ..strokeWidth = 2 * s,
      );
    }
  }
}

/// A pot coming to the boil: bubbles rise, swell and pop at the surface.
class BubblesPainter extends LoaderPainter {
  BubblesPainter(super.clock, super.color);

  static const double _dur = 1.9;

  /// (x, begin, radius) in a 40-box.
  static const List<(double, double, double)> _bubbles = [
    (10, 0, 3.4),
    (20, -0.7, 4.6),
    (30, -1.3, 2.8),
    (15, -1.7, 2.2),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;

    for (final (x, begin, r) in _bubbles) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      // Rise from the floor to the surface, swelling as the pressure drops.
      final y = 34 - 28 * p;
      final radius = r * (0.55 + 0.45 * p);
      // The last fifth is the pop: it thins to a ring and vanishes.
      final popping = p > 0.8;
      final t = popping ? (p - 0.8) / 0.2 : 0.0;
      canvas.drawCircle(
        Offset(x * s, y * s),
        (radius + (popping ? t * 2 : 0)) * s,
        Paint()
          ..style = popping ? PaintingStyle.stroke : PaintingStyle.fill
          ..strokeWidth = 1.4 * s
          ..color = color.withValues(alpha: popping ? 1 - t : 0.85),
      );
    }
  }
}

const steamLoader = SvgLoaderSpec(id: 'steam', painter: SteamPainter.new);

const bubblesLoader = SvgLoaderSpec(
  id: 'bubbles',
  painter: BubblesPainter.new,
);
