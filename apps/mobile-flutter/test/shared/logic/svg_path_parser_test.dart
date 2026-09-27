import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/logic/svg_path_parser.dart';

void main() {
  group('parseSvgPathData', () {
    test('draws absolute lines with H and V', () {
      final path = parseSvgPathData('M20 68H188V776H20Z');

      expect(path.getBounds(), const Rect.fromLTRB(20, 68, 188, 776));
      expect(path.contains(const Offset(100, 400)), isTrue);
      expect(path.contains(const Offset(200, 400)), isFalse);
    });

    test('follows quadratic and cubic curves, not their chords', () {
      // Both bow down to y = 50 at x = 50; the chord runs along y = 0.
      for (final data in [
        'M0 0Q50 100 100 0Z',
        'M0 0C0 66.667 100 66.667 100 0Z',
      ]) {
        final path = parseSvgPathData(data);
        expect(path.contains(const Offset(50, 45)), isTrue, reason: data);
        expect(path.contains(const Offset(50, 55)), isFalse, reason: data);
      }
    });

    test('treats extra pairs after a moveto as linetos', () {
      final triangle = parseSvgPathData('M0 0 10 0 10 10Z');

      expect(triangle.contains(const Offset(8, 2)), isTrue);
      expect(triangle.contains(const Offset(2, 8)), isFalse);
    });

    test('rejects anything the brand files never contain', () {
      const unsupported = {
        'm0 0h10v10z': 'relative commands',
        'M0 0A5 5 0 0 1 10 10Z': 'an arc',
        'M0 0L1e3 0Z': 'an exponent',
        'M0 0L10Z': 'a command short of numbers',
        'M0 0L10 10Z 5': 'a stray number after Z',
        '10 10': 'numbers before any command',
      };
      unsupported.forEach((data, what) {
        expect(
          () => parseSvgPathData(data),
          throwsFormatException,
          reason: what,
        );
      });
    });
  });
}
