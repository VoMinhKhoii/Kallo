import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:kallo_mobile/features/logging/logic/portion/portion_display.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

/// Half and counted container vessels: the same numbers and words as web's
/// `components/logging/feed/meal-entry/portion/__tests__/portion-display.test.ts`.

/// A Vietnamese bowl of plain rice: 150 g in its small bowl.
ContainerVessel _rice([double count = 1]) => ContainerVessel(
  family: ContainerFamily.bowl,
  tier: 1,
  dishClass: DishClass.solid,
  smallBowlG: 150,
  count: count,
);

ContainerVessel _pho([double count = 1]) => ContainerVessel(
  family: ContainerFamily.bowl,
  tier: 2,
  dishClass: DishClass.soup,
  count: count,
);

String _label(ContainerVessel v, int grams, [String locale = 'vi']) =>
    portionDisplayFor(v, grams, locale).label;

void main() {
  group('countPrefix', () {
    test(
      'writes halves and quarters as fractions, other counts as a multiple',
      () {
        expect(countPrefix(1), '');
        expect(countPrefix(0.5), '½ ');
        expect(countPrefix(0.25), '¼ ');
        expect(countPrefix(1.5), '1.5 × ');
        expect(countPrefix(2), '2 × ');
      },
    );
  });

  group('a counted container', () {
    test('scales every anchor by the count, like pieces do', () {
      final one = buildContainerAnchors(_pho(), 'en');
      final two = buildContainerAnchors(_pho(2), 'en');
      expect(
        two.map((a) => a.value).toList(),
        one.map((a) => a.value * 2).toList(),
      );
      expect(two[1].label, '2 × medium bowl');
    });

    test('reads half a bowl of rice in whole rice bowls', () {
      final half = buildContainerAnchors(_rice(0.5), 'vi');
      expect(half.first.value, 75);
      expect(half.first.label, '½ chén nhỏ');
      expect(_label(_rice(0.5), 75), '½ chén nhỏ');
      expect(_label(_rice(0.5), 75, 'en'), '½ small bowl');
    });

    test('names one, one and a half, and two bowls', () {
      expect(_label(_rice(), 150), 'chén nhỏ');
      expect(_label(_rice(1.5), 225), '1.5 × chén nhỏ');
      expect(_label(_rice(2), 300), '2 × chén nhỏ');
      final twoPho = buildContainerAnchors(_pho(2), 'vi')[1].value.round();
      expect(_label(_pho(2), twoPho), '2 × tô vừa');
      expect(_label(_pho(2), twoPho, 'en'), '2 × medium bowl');
    });

    test('opens a half-bowl meal at its own grams, inside the tape', () {
      final v = _rice(0.5);
      final envelope = vesselTapeRange(v, buildAnchors(v, 'vi'));
      expect(envelope.min, lessThanOrEqualTo(75));
      expect(envelope.max, greaterThan(75));
    });
  });

  group('dragging a container down to half', () {
    final v = _rice();
    final anchors = buildAnchors(v, 'vi');
    final envelope = vesselTapeRange(v, anchors);

    test('starts the tape at half the first vessel, not 60% of it', () {
      expect(envelope.min, 75);
    });

    test(
      'names half the first vessel near the left end, the vessel above it',
      () {
        expect(_label(v, 75), '½ chén nhỏ');
        expect(_label(v, 100), '½ chén nhỏ');
        expect(_label(v, 120), 'chén nhỏ');
        expect(_label(v, 150, 'en'), 'small bowl');
      },
    );

    test(
      'commits tier 1 and keeps the count, so the card names the same half',
      () {
        final committed = repointVessel(v, anchors, 75);
        expect(committed, v);
        expect(_label(committed as ContainerVessel, 75), '½ chén nhỏ');
      },
    );

    test('halves a counted vessel to a whole one', () {
      final two = _rice(2);
      expect(vesselTapeRange(two, buildAnchors(two, 'vi')).min, 150);
      expect(_label(two, 150), 'chén nhỏ');
    });

    test('keeps the count and moves the tier as the grams cross anchors', () {
      final two = _pho(2);
      final twoAnchors = buildAnchors(two, 'vi');
      final large = twoAnchors[2].value.round();
      final at = repointVessel(two, twoAnchors, large);
      expect(at, two.copyWith(tier: 3));
      expect(_label(at as ContainerVessel, large), '2 × tô lớn');
      expect(repointVessel(two, twoAnchors, twoAnchors[1].value.round()), two);
    });
  });

  group('the piece tape is unchanged', () {
    test('still starts at 60% of the smallest cut', () {
      const piece = PieceVessel(tier: 3, count: 1, kind: PieceKind.meat);
      final anchors = buildAnchors(piece, 'en');
      expect(
        vesselTapeRange(piece, anchors).min,
        (anchors.first.value * 0.6).round(),
      );
    });
  });

  group('ContainerVessel.fromJson count', () {
    Map<String, dynamic> json(Object? count) => {
      'family': 'bowl',
      'tier': 1,
      'dishClass': 'solid',
      'smallBowlG': 150,
      if (count != null) 'count': count,
    };

    test('reads one when absent, and leaves it out of the JSON', () {
      final vessel = ClientVessel.fromJson(json(null)) as ContainerVessel;
      expect(vessel.count, 1);
      expect(vessel.toJson().containsKey('count'), isFalse);
    });

    test('keeps half and two bowls, and round-trips them', () {
      for (final count in [0.5, 2]) {
        final vessel = ClientVessel.fromJson(json(count));
        expect(vessel, _rice(count.toDouble()));
        expect(ClientVessel.fromJson(vessel!.toJson()), vessel);
      }
    });

    test('drops the vessel for a count no bowl can be, never throws', () {
      for (final count in [
        0,
        0.1,
        -2,
        21,
        double.nan,
        double.infinity,
        '2',
        true,
      ]) {
        expect(ClientVessel.fromJson(json(count)), isNull, reason: '$count');
      }
    });
  });
}
