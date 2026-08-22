import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Prep-bench loaders: a knife on a board, rice falling, and a pour.

/// A blade chopping: it lifts, comes down onto the board, and the board
/// answers with a small shudder.
class KnifeChopPainter extends LoaderPainter {
  KnifeChopPainter(super.clock, super.color);

  static const double _dur = 0.85;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    // Fast down (first 35%), slower lift back — a chop, not a metronome.
    final down = p < 0.35
        ? Curves.easeIn.transform(p / 0.35)
        : 1 - Curves.easeOut.transform((p - 0.35) / 0.65);

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2 * s
      ..strokeCap = StrokeCap.round
      ..color = color;

    // The board takes the hit right as the blade lands.
    final hit = (down > 0.92) ? (down - 0.92) / 0.08 : 0.0;
    canvas.drawLine(
      Offset(6 * s, (32 + hit) * s),
      Offset(34 * s, (32 + hit) * s),
      stroke,
    );

    // Blade: pivots at the heel so the tip travels furthest. The angle is
    // POSITIVE — Flutter's y grows downward, so a negative rotation swung the
    // tip below the board and clean off the canvas.
    canvas.save();
    canvas.translate(31 * s, 28 * s);
    canvas.rotate(0.75 * (1 - down));
    canvas.drawLine(
      Offset(-22 * s, 0),
      Offset.zero,
      stroke..strokeWidth = 2.6 * s,
    );
    // Handle, carried on past the heel.
    canvas.drawLine(
      Offset(0, -1 * s),
      Offset(6 * s, -4 * s),
      stroke..strokeWidth = 2.2 * s,
    );
    canvas.restore();
  }
}

/// Grains falling into a heap — measuring something out.
class RiceFallPainter extends LoaderPainter {
  RiceFallPainter(super.clock, super.color);

  static const double _dur = 1.3;

  /// (x, begin, lean) in a 40-box.
  static const List<(double, double, double)> _grains = [
    (16, 0, -0.4),
    (21, -0.45, 0.3),
    (25, -0.9, -0.15),
    (18, -1.15, 0.45),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final paint = Paint()..color = color;

    // The heap they are landing in.
    final heap = Path()
      ..moveTo(10 * s, 34 * s)
      ..quadraticBezierTo(20 * s, 24 * s, 30 * s, 34 * s)
      ..close();
    canvas.drawPath(heap, Paint()..color = color.withValues(alpha: 0.45));

    for (final (x, begin, lean) in _grains) {
      final p = loaderPhase(seconds, _dur, begin: begin);
      // Accelerating fall, gone once it reaches the heap.
      final y = 4 + 24 * (p * p);
      if (y > 28) continue;
      canvas.save();
      canvas.translate(x * s, y * s);
      canvas.rotate(lean);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: 2.6 * s, height: 5 * s),
          Radius.circular(1.3 * s),
        ),
        paint,
      );
      canvas.restore();
    }
  }
}

/// A drip from a spout, and the ring it leaves on the surface.
class PourDripPainter extends LoaderPainter {
  PourDripPainter(super.clock, super.color);

  static const double _dur = 1.4;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    final falling = p < 0.55;

    // The vessel, tipped: a lip on the left that the drop leaves from.
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;
    canvas.drawPath(
      Path()
        ..moveTo(9 * s, 3 * s)
        ..lineTo(27 * s, 3 * s)
        ..lineTo(23 * s, 12 * s)
        ..lineTo(15 * s, 12 * s)
        ..close(),
      stroke,
    );

    if (falling) {
      final t = p / 0.55;
      // A teardrop: stretched while it accelerates.
      final y = 14 + 15 * (t * t);
      final stretch = 1 + t * 0.9;
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset(19 * s, y * s),
          width: 6.5 * s,
          height: 6.5 * s * stretch,
        ),
        Paint()..color = color,
      );
    } else {
      // The ripple it left, spreading and fading.
      final t = (p - 0.55) / 0.45;
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(19 * s, 32 * s),
          width: (8 + 20 * t) * s,
          height: (3 + 7 * t) * s,
        ),
        0,
        2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6 * s
          ..color = color.withValues(alpha: 1 - t),
      );
    }
  }
}

const knifeChopLoader = SvgLoaderSpec(
  id: 'knife-chop',
  painter: KnifeChopPainter.new,
);

const riceFallLoader = SvgLoaderSpec(
  id: 'rice-fall',
  painter: RiceFallPainter.new,
);

const pourDripLoader = SvgLoaderSpec(
  id: 'pour-drip',
  painter: PourDripPainter.new,
);
