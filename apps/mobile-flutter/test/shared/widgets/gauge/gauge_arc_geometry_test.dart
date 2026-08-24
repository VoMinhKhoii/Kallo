import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_arc_geometry.dart';

/// The reference dial, read off the rendered source component rather than
/// re-derived here: centre (268, 96), inner 54, outer 72, cornerRadius 8,
/// paddingAngle 4, 210° → −30°, filled to 84%.
///
/// Its filled segment begins at 213.0091,127.749 — the point where the first
/// corner circle meets the sector's radial edge. Every expectation below is one
/// of that path's own numbers, so this test fails if our geometry drifts from
/// the shape it was ported from.
const _center = Offset(268, 96);
const _outerRadius = 72.0;

Offset _startOf(Path path) =>
    path.computeMetrics().first.getTangentForOffset(0)!.position;

/// Walk the outline and take the real extremes.
///
/// `Path.getBounds()` is no use here: for arcs it returns the bounds of the
/// CONTROL points, which sit well outside a curve this round — it reported a
/// left edge 23px beyond the dial's own radius.
Rect _tightBounds(Path path) {
  var left = double.infinity, top = double.infinity;
  var right = double.negativeInfinity, bottom = double.negativeInfinity;
  for (final metric in path.computeMetrics()) {
    for (var i = 0; i <= 400; i++) {
      final p = metric.getTangentForOffset(metric.length * i / 400)!.position;
      left = math.min(left, p.dx);
      top = math.min(top, p.dy);
      right = math.max(right, p.dx);
      bottom = math.max(bottom, p.dy);
    }
  }
  return Rect.fromLTRB(left, top, right, bottom);
}

void main() {
  group('gaugePaths', () {
    test('starts where the source component starts', () {
      final paths = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 0.84,
      );
      final start = _startOf(paths.filled);
      expect(start.dx, closeTo(213.0091, 0.05));
      expect(start.dy, closeTo(127.749, 0.05));
    });

    test('spans the reference sector', () {
      final bounds = _tightBounds(gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 0.84,
      ).filled);
      // Left and top are the sector's own extremes: 180° and 90° at radius 72.
      expect(bounds.left, closeTo(_center.dx - _outerRadius, 0.05));
      expect(bounds.top, closeTo(_center.dy - _outerRadius, 0.05));
      // The far end stops short of the full circle — 84%, not 100%.
      expect(bounds.right, lessThan(_center.dx + _outerRadius));
      expect(bounds.right, closeTo(336.1, 0.6));
    });

    test('the remainder is a separate pill, not a track behind the fill', () {
      final paths = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 0.84,
      );
      // A 4° gap sits between them, so the two never share an edge.
      expect(paths.filled.getBounds().overlaps(paths.remainder.getBounds()),
          isTrue,
          reason: 'bounding boxes still overlap — they are arcs, not blocks');
      final gap = _startOf(paths.remainder) - _startOf(paths.filled);
      expect(gap.distance, greaterThan(1));
    });

    test('drops the segment that has no sweep left', () {
      final empty = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 0,
      );
      expect(empty.filled.computeMetrics().isEmpty, isTrue);
      expect(empty.remainder.computeMetrics().isEmpty, isFalse);

      final full = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 1,
      );
      expect(full.filled.computeMetrics().isEmpty, isFalse);
      expect(full.remainder.computeMetrics().isEmpty, isTrue);
    });

    test('clamps past target rather than winding past the sweep', () {
      final over = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 1.6,
      );
      final full = gaugePaths(
        center: _center,
        outerRadius: _outerRadius,
        progress: 1,
      );
      expect(over.filled.getBounds(), full.filled.getBounds());
    });

    test('holds its proportions when scaled', () {
      // The macro dials are the same shape at 44. Band and corner are ratios,
      // so the small dial's bounds are the reference's, scaled.
      final small = gaugePaths(
        center: Offset.zero,
        outerRadius: 36,
        progress: 0.84,
      ).filled.getBounds();
      final large = gaugePaths(
        center: Offset.zero,
        outerRadius: 72,
        progress: 0.84,
      ).filled.getBounds();
      expect(small.width * 2, closeTo(large.width, 0.05));
      expect(small.height * 2, closeTo(large.height, 0.05));
    });
  });

  test('gaugeTipOffset puts the tips half a radius below centre', () {
    // 210° and −30° both sit at sin = −0.5, so the tips are at r/2 below the
    // centre. The readout leans on this to sit level with them.
    expect(gaugeTipOffset(104), 52);
    final tip = arcPoint(_center, _outerRadius, kGaugeEndAngle);
    expect(tip.dy - _center.dy, closeTo(gaugeTipOffset(_outerRadius), 0.001));
  });
}
