import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/logic/split_parts.dart';

void main() {
  group('evenParts', () {
    test('splits the dish evenly, remainder to the earliest seats', () {
      expect(evenParts(2), [10, 10]);
      // 20 is not divisible by 3, so an even three-way split is 7/7/6 — the
      // meter labels it 35/35/30 rather than pretending to be thirds.
      expect(evenParts(3), [7, 7, 6]);
      expect(evenParts(4), [5, 5, 5, 5]);
      expect(evenParts(5), [4, 4, 4, 4, 4]);
      expect(evenParts(6), [4, 4, 3, 3, 3, 3]);
    });

    test('always sums to the whole dish and never breaks the floor', () {
      for (var p = 2; p <= kMaxParticipants; p++) {
        final parts = evenParts(p);
        expect(parts.length, p);
        expect(parts.reduce((a, b) => a + b), kTotalParts);
        expect(
          parts.reduce((a, b) => a < b ? a : b),
          greaterThanOrEqualTo(kMinParts),
        );
      }
    });
  });

  group('clampNotch', () {
    test('a notch never passes its left neighbour', () {
      // Three runs of 7/7/6. Notch 1 sits after run 1, i.e. at part 14.
      // Dragging it to part 2 would put run 1 at a negative size.
      final at = clampNotch(
        parts: const [7, 7, 6],
        boundary: 1,
        desiredLeftEnd: 2,
      );
      // It stops two parts past where run 0 ends (7), i.e. at 9.
      expect(at, 9);
    });

    test('a notch never passes its right neighbour', () {
      final at = clampNotch(
        parts: const [7, 7, 6],
        boundary: 1,
        desiredLeftEnd: 99,
      );
      // Runs 1+2 hold 13 parts starting at 7; the right run keeps its floor,
      // so the notch stops at 7 + 13 - 2 = 18.
      expect(at, 18);
    });

    test('leaves a legal position alone', () {
      expect(
        clampNotch(parts: const [10, 10], boundary: 0, desiredLeftEnd: 13),
        13,
      );
    });

    test('clamps to the floor on the very first boundary', () {
      expect(
        clampNotch(parts: const [10, 10], boundary: 0, desiredLeftEnd: 0),
        kMinParts,
      );
      expect(
        clampNotch(parts: const [10, 10], boundary: 0, desiredLeftEnd: 20),
        kTotalParts - kMinParts,
      );
    });
  });

  group('partsAfterDrag', () {
    test('moves parts between the two runs the notch bounds, only', () {
      final next = partsAfterDrag(
        parts: const [7, 7, 6],
        boundary: 1,
        desiredLeftEnd: 16,
      );
      expect(next, [7, 9, 4]);
      expect(next.reduce((a, b) => a + b), kTotalParts);
    });

    test('a clamped drag still sums to the whole dish', () {
      final next = partsAfterDrag(
        parts: const [7, 7, 6],
        boundary: 1,
        desiredLeftEnd: 999,
      );
      expect(next.reduce((a, b) => a + b), kTotalParts);
      expect(next.last, kMinParts);
    });
  });

  group('partsAfterRemoval', () {
    test('returns the freed parts to the table and still sums to the dish', () {
      final next = partsAfterRemoval(const [8, 6, 6], 1);
      expect(next.length, 2);
      expect(next.reduce((a, b) => a + b), kTotalParts);
    });

    test('never leaves anyone under the floor', () {
      for (var i = 0; i < 4; i++) {
        final next = partsAfterRemoval(const [5, 5, 5, 5], i);
        expect(
          next.reduce((a, b) => a < b ? a : b),
          greaterThanOrEqualTo(kMinParts),
        );
        expect(next.reduce((a, b) => a + b), kTotalParts);
      }
    });
  });

  group('partsAfterAdd', () {
    test('seats the newcomer at the floor, taken from the largest run', () {
      final next = partsAfterAdd(const [10, 10]);
      expect(next.length, 3);
      expect(next.last, kMinParts);
      expect(next.reduce((a, b) => a + b), kTotalParts);
      // Taken from whoever could most afford it, not spread over everyone.
      expect(next[0], 9);
      expect(next[1], 9);
    });

    test('preserves a hand-set split as far as the floor allows', () {
      final next = partsAfterAdd(const [14, 6]);
      expect(next.reduce((a, b) => a + b), kTotalParts);
      expect(next.last, kMinParts);
      // The 6 is untouched; the 14 pays for the newcomer.
      expect(next[0], 12);
      expect(next[1], 6);
    });

    test('fills the table to six without breaking the floor', () {
      var parts = evenParts(2);
      while (parts.length < kMaxParticipants) {
        parts = partsAfterAdd(parts);
        expect(parts.reduce((a, b) => a + b), kTotalParts);
        expect(
          parts.reduce((a, b) => a < b ? a : b),
          greaterThanOrEqualTo(kMinParts),
        );
      }
      expect(parts.length, kMaxParticipants);
    });
  });
}
