import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

/// The vessel arrives from the server on the SSE `result` frame and on restored
/// `/api/v1/meals/pending` rows. It is a display affordance, so an unknown or
/// malformed payload must degrade to "no portion line" — never take the logging
/// feed down with a parse error.

Map<String, dynamic> _item(Map<String, dynamic>? vessel) => {
  'id': 'item-1',
  'name': 'cá kho',
  'quantity': 250,
  'unit': 'g',
  'macros': {'calories': 410, 'protein': 30, 'carbs': 4, 'fat': 30},
  if (vessel != null) 'vessel': vessel,
};

void main() {
  group('ClientVessel.fromJson', () {
    test('parses a container vessel', () {
      final vessel = ClientVessel.fromJson({
        'family': 'bowl',
        'tier': 3,
        'dishClass': 'soup',
      });
      expect(
        vessel,
        const ContainerVessel(
          family: ContainerFamily.bowl,
          tier: 3,
          dishClass: DishClass.soup,
        ),
      );
    });

    test('parses a piece vessel', () {
      final vessel = ClientVessel.fromJson({
        'family': 'piece',
        'tier': 4,
        'count': 2,
        'kind': 'fish',
      });
      expect(
        vessel,
        const PieceVessel(tier: 4, count: 2, kind: PieceKind.fish),
      );
    });

    test('keeps a fractional piece count instead of truncating it', () {
      // The server's `count` is a plain number and the decomposition prompt
      // emits fractions ("một lát rưỡi" → 1.5); `resolvePieceVessel` rejects
      // only count < 1, so 1.5 arrives here. Truncating to 1 built a whole
      // different anchor set from web's for the same meal.
      final vessel =
          ClientVessel.fromJson({
                'family': 'piece',
                'tier': 3,
                'count': 1.5,
                'kind': 'fish',
              })!
              as PieceVessel;
      expect(vessel.count, 1.5);
    });

    test('returns null for anything it cannot render', () {
      expect(ClientVessel.fromJson(null), isNull);
      // A family this build doesn't know (a future server addition).
      expect(
        ClientVessel.fromJson({'family': 'tray', 'tier': 1, 'dishClass': 'solid'}),
        isNull,
      );
      // Out-of-range tiers would index past the tier tables.
      expect(
        ClientVessel.fromJson({'family': 'bowl', 'tier': 9, 'dishClass': 'soup'}),
        isNull,
      );
      expect(
        ClientVessel.fromJson({
          'family': 'piece',
          'tier': 6,
          'count': 1,
          'kind': 'fish',
        }),
        isNull,
      );
      // Piece payloads missing their discriminating fields.
      expect(ClientVessel.fromJson({'family': 'piece', 'tier': 2}), isNull);
      expect(
        ClientVessel.fromJson({'family': 'bowl', 'dishClass': 'soup'}),
        isNull,
      );
    });
  });

  group('MealItem vessel round-trip', () {
    test('parses, re-serializes and survives copyWith', () {
      final item = MealItem.fromJson(
        _item({'family': 'piece', 'tier': 3, 'count': 1, 'kind': 'poultry'}),
      );
      expect(item.vessel, isA<PieceVessel>());
      expect(item.toJson()['vessel'], {
        'family': 'piece',
        'tier': 3,
        'count': 1,
        'kind': 'poultry',
      });

      // A quantity edit must not drop the vessel.
      expect(item.copyWith(quantity: 300).vessel, item.vessel);
      // …and a re-point must replace it.
      final repointed = item.copyWith(
        vessel: const PieceVessel(tier: 5, count: 1, kind: PieceKind.poultry),
      );
      expect((repointed.vessel! as PieceVessel).tier, 5);
    });

    test('omits the key entirely when there is no vessel', () {
      final item = MealItem.fromJson(_item(null));
      expect(item.vessel, isNull);
      expect(item.toJson().containsKey('vessel'), isFalse);
    });
  });
}
