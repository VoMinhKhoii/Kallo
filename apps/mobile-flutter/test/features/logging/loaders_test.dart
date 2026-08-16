import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/widgets/loaders/loader_math.dart';
import 'package:kallo_mobile/features/logging/widgets/loaders/loader_registry.dart';

void main() {
  group('loader math', () {
    test('phase stays in [0,1) and wraps continuously', () {
      expect(loaderPhase(0, 2), 0);
      expect(loaderPhase(1, 2), 0.5);
      expect(loaderPhase(2, 2), 0);
      // Just before and just after a period boundary are adjacent, not a jump.
      expect(loaderPhase(3.99, 2), closeTo(0.995, 1e-9));
      expect(loaderPhase(4.01, 2), closeTo(0.005, 1e-9));
    });

    test('a negative begin pre-rolls rather than going negative', () {
      final p = loaderPhase(0, 1.8, begin: -0.9);
      expect(p, closeTo(0.5, 1e-9));
      expect(p, inInclusiveRange(0, 1));
    });

    test('a positive begin delays the start', () {
      expect(loaderPhase(0.5, 1, begin: 0.5), 0);
    });

    test('sampleLinear walks evenly spaced keyframes', () {
      const values = [0.0, 10.0, 20.0];
      expect(sampleLinear(values, 0), 0);
      expect(sampleLinear(values, 0.25), 5);
      expect(sampleLinear(values, 0.5), 10);
      expect(sampleLinear(values, 1), 20);
    });

    test('sampleSpline hits both endpoints', () {
      const ease = Cubic(0.165, 0.84, 0.44, 1);
      expect(sampleSpline(1, 20, 0, ease), closeTo(1, 1e-6));
      expect(sampleSpline(1, 20, 1, ease), closeTo(20, 1e-6));
    });
  });

  group('registry', () {
    test('is spinner-free and uniquely named', () {
      expect(kSvgLoaders, hasLength(19));
      expect(
        kSvgLoaders.map((l) => l.id).toSet(),
        {
          // The non-circular survivors of the SVG-Loaders set.
          'audio', 'bars', 'grid', 'hearts', 'three-dots',
          // Kitchen.
          'bubbles', 'knife-chop', 'pan-flip', 'pour-drip', 'rice-fall',
          'steam', 'whisk',
          // Motion.
          'bounce', 'dash', 'ecg', 'flip-squares', 'jelly', 'ladder', 'wave',
        },
      );
    });

    test('carries none of the retired spinners', () {
      // These read as a generic loading circle, which is the one thing this
      // pool exists not to be.
      const retired = {
        'oval', 'tail-spin', 'rings', 'puff', 'spinning-circles', 'circles',
        'ball-triangle',
      };
      expect(kSvgLoaders.map((l) => l.id).toSet().intersection(retired), isEmpty);
    });

    test('every loader renders at a positive size', () {
      for (final spec in kSvgLoaders) {
        final size = spec.sizeFor(20);
        expect(size.width, greaterThan(0), reason: spec.id);
        expect(size.height, greaterThan(0), reason: spec.id);
      }
    });

    test('picks stay in range', () {
      final random = Random(1);
      for (var i = 0; i < 200; i++) {
        expect(pickLoaderIndex(random), inInclusiveRange(0, 18));
      }
    });

    test('loaderAt wraps instead of throwing on a stale index', () {
      // The index is persisted across rebuilds; it must never crash the feed.
      expect(loaderAt(0).id, kSvgLoaders.first.id);
      expect(loaderAt(19).id, kSvgLoaders.first.id);
      expect(loaderAt(-1).id, kSvgLoaders[1].id);
    });
  });

  group('painters', () {
    // Every loader is sampled across a full second of its own timeline: a
    // painter that produces a NaN radius or a negative stroke width throws
    // here rather than on a user's screen mid-analysis.
    test('paint without throwing across their cycle', () {
      for (final spec in kSvgLoaders) {
        for (final seconds in [0.0, 0.13, 0.5, 0.9, 1.0, 2.4, 7.7]) {
          final clock = ValueNotifier<double>(seconds);
          final painter = spec.painter(clock, const Color(0xFF6E6D66));
          final recorder = ui.PictureRecorder();
          final size = spec.sizeFor(20);
          expect(
            () => painter.paint(Canvas(recorder), size),
            returnsNormally,
            reason: '${spec.id} at ${seconds}s',
          );
          recorder.endRecording().dispose();
          clock.dispose();
        }
      }
    });
  });
}
