import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../loader_math.dart';
import '../svg_loader.dart';

/// Loaders drawn as a single travelling stroke.

/// A pulse tracing across a monitor line and resetting.
class EcgPainter extends LoaderPainter {
  EcgPainter(super.clock, super.color);

  static const double _dur = 1.6;

  /// The trace, as (x, y) in a 40-box: flat, then the spike, then flat.
  static const List<Offset> _trace = [
    Offset(2, 20),
    Offset(12, 20),
    Offset(15, 13),
    Offset(18, 30),
    Offset(21, 7),
    Offset(24, 20),
    Offset(38, 20),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    final headX = 2 + 36 * p;

    final path = Path()..moveTo(_trace.first.dx * s, _trace.first.dy * s);
    for (var i = 1; i < _trace.length; i++) {
      final a = _trace[i - 1];
      final b = _trace[i];
      if (b.dx <= headX) {
        path.lineTo(b.dx * s, b.dy * s);
        continue;
      }
      // Stop mid-segment at the head, interpolating so the line grows smoothly.
      final t = ((headX - a.dx) / (b.dx - a.dx)).clamp(0.0, 1.0);
      path.lineTo((a.dx + (b.dx - a.dx) * t) * s, (a.dy + (b.dy - a.dy) * t) * s);
      break;
    }

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2 * s
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        // Fades out over the last fifth so the reset is not a hard cut.
        ..color = color.withValues(alpha: p > 0.8 ? (1 - p) / 0.2 : 1),
    );
  }
}

/// A dash chasing its own tail round a rounded track — the one nod to a
/// spinner, but on a track rather than a circle.
class DashPainter extends LoaderPainter {
  DashPainter(super.clock, super.color);

  static const double _dur = 1.4;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    final p = loaderPhase(seconds, _dur);
    final track = RRect.fromRectAndRadius(
      Rect.fromLTWH(5 * s, 11 * s, 30 * s, 18 * s),
      Radius.circular(9 * s),
    );

    canvas.drawRRect(
      track,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2 * s
        ..color = color.withValues(alpha: 0.22),
    );

    // Walk the same rounded rect as a path and draw the slice under the head.
    final metric = (Path()..addRRect(track)).computeMetrics().first;
    final len = metric.length;
    // The dash grows and shrinks as it travels, so it never reads as a
    // constant-speed spinner.
    final span = len * (0.12 + 0.16 * (0.5 + 0.5 * math.sin(p * 2 * math.pi)));
    final start = len * p;
    final end = start + span;

    final head = end <= len
        ? metric.extractPath(start, end)
        : (metric.extractPath(start, len)
          ..addPath(metric.extractPath(0, end - len), Offset.zero));

    canvas.drawPath(
      head,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6 * s
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }
}

const ecgLoader = SvgLoaderSpec(id: 'ecg', painter: EcgPainter.new);

const dashLoader = SvgLoaderSpec(id: 'dash', painter: DashPainter.new);
