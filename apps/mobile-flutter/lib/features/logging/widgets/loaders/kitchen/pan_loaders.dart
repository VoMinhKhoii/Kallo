import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Loaders that read as active cooking: tossing a pan, and stirring a bowl.

/// A pan tossing something and catching it again. The pan dips to load, the
/// disc arcs up and turns over, then both settle.
class PanFlipPainter extends LoaderPainter {
  PanFlipPainter(super.clock, super.color);

  static const double _dur = 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2 * s
      ..strokeCap = StrokeCap.round
      ..color = color;

    // The pan tips down to launch and rocks back — a quarter of the cycle.
    final tilt = math.sin(p * 2 * math.pi) * 0.22;
    canvas.save();
    canvas.translate(20 * s, 27 * s);
    canvas.rotate(tilt);
    // Bowl of the pan: a shallow half-round with a handle off to the right.
    canvas.drawArc(
      Rect.fromCenter(center: Offset.zero, width: 22 * s, height: 14 * s),
      0,
      math.pi,
      false,
      stroke,
    );
    canvas.drawLine(Offset(11 * s, 0), Offset(19 * s, -3 * s), stroke);
    canvas.restore();

    // The food: a flattened disc on a parabola, turning over at the top.
    final hop = 4 * p * (1 - p); // 0→1→0, peaking mid-cycle
    final cy = 20 - 20 * hop;
    final spin = p * 2 * math.pi;
    canvas.save();
    canvas.translate(20 * s, cy * s);
    // Squash to nothing edge-on, which is what sells the turn.
    canvas.scale(1, math.cos(spin).abs().clamp(0.15, 1.0));
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: 13 * s, height: 6 * s),
      Paint()..color = color,
    );
    canvas.restore();
  }
}

/// A whisk working round a bowl — three tines orbiting, with the trail of the
/// stroke behind them.
class WhiskPainter extends LoaderPainter {
  WhiskPainter(super.clock, super.color);

  static const double _dur = 1.1;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final centre = Offset(20 * s, 22 * s);
    final p = loaderPhase(seconds, _dur);
    final angle = p * 2 * math.pi;

    // The swirl left behind: a fading arc trailing the whisk.
    canvas.drawArc(
      Rect.fromCircle(center: centre, radius: 11 * s),
      angle - 2.2,
      2.2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6 * s
        ..strokeCap = StrokeCap.round
        ..color = color.withValues(alpha: 0.28),
    );

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2 * s
      ..strokeCap = StrokeCap.round
      ..color = color;

    // The bowl it works in — without it the whisk read as a lone diagonal.
    canvas.drawArc(
      Rect.fromCenter(center: centre, width: 28 * s, height: 24 * s),
      0.15,
      math.pi - 0.3,
      false,
      stroke,
    );

    // The whisk leans into the stroke: the head orbits, the grip stays up top.
    final head = centre + Offset(math.cos(angle) * 7 * s, math.sin(angle) * 4 * s);
    final grip = Offset(20 * s + math.cos(angle) * 3 * s, 3 * s);
    canvas.drawLine(grip, head, stroke..strokeWidth = 2.2 * s);

    // The wire cage: two loops squashed toward the direction of travel.
    for (final lean in const [-1.0, 1.0]) {
      canvas.drawOval(
        Rect.fromCenter(
          center: head + Offset(lean * 2 * s, 3 * s),
          width: 5 * s,
          height: 10 * s,
        ),
        stroke..strokeWidth = 1.4 * s,
      );
    }
  }
}

const panFlipLoader = SvgLoaderSpec(
  id: 'pan-flip',
  painter: PanFlipPainter.new,
);

const whiskLoader = SvgLoaderSpec(id: 'whisk', painter: WhiskPainter.new);
