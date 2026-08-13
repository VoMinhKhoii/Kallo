import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Loaders built on a travelling wave or a spring.

/// Five dots riding a sine wave.
class WavePainter extends LoaderPainter {
  WavePainter(super.clock, super.color);

  static const double _dur = 1.1;
  static const int _count = 5;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    final step = 34 / (_count - 1);

    for (var i = 0; i < _count; i++) {
      // Each dot lags the one before, so the crest travels rather than pulsing.
      final phase = (p - i * 0.09) * 2 * math.pi;
      final y = 20 + math.sin(phase) * 9;
      canvas.drawCircle(
        Offset((3 + i * step) * s, y * s),
        3 * s,
        Paint()..color = color.withValues(alpha: 0.55 + 0.45 * math.sin(phase)),
      );
    }
  }
}

/// A ball bouncing, squashing as it lands and stretching as it leaves.
class BouncePainter extends LoaderPainter {
  BouncePainter(super.clock, super.color);

  static const double _dur = 0.75;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);

    // |cos| gives the true parabola-ish bounce with a sharp turn at the floor.
    final height = (math.cos(p * 2 * math.pi) + 1) / 2; // 1 at top, 0 at floor
    final cy = 30 - 20 * height;
    // Squash only in the last of the descent, and conserve area.
    final squash = height < 0.12 ? 1 + (0.12 - height) * 2.2 : 1.0;
    final rx = 6.5 * squash;
    final ry = 6.5 / squash;

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(20 * s, (cy + (6.5 - ry)) * s),
        width: rx * 2 * s,
        height: ry * 2 * s,
      ),
      Paint()..color = color,
    );
    // The floor it is working against.
    canvas.drawLine(
      Offset(8 * s, 37 * s),
      Offset(32 * s, 37 * s),
      Paint()
        ..strokeWidth = 1.6 * s
        ..strokeCap = StrokeCap.round
        ..color = color.withValues(alpha: 0.3),
    );
  }
}

/// A rounded square wobbling like set jelly — squash and stretch on one axis,
/// then the other.
class JellyPainter extends LoaderPainter {
  JellyPainter(super.clock, super.color);

  static const double _dur = 1.2;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    // A decaying wobble, reset each cycle.
    final wobble = math.sin(p * 4 * math.pi) * (1 - p) * 0.28;
    final w = 20 * (1 + wobble);
    final h = 20 * (1 - wobble);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(20 * s, 20 * s + (20 - h) / 2 * s),
          width: w * s,
          height: h * s,
        ),
        Radius.circular(6 * s),
      ),
      Paint()..color = color,
    );
  }
}

const waveLoader = SvgLoaderSpec(id: 'wave', painter: WavePainter.new);

const bounceLoader = SvgLoaderSpec(id: 'bounce', painter: BouncePainter.new);

const jellyLoader = SvgLoaderSpec(id: 'jelly', painter: JellyPainter.new);
