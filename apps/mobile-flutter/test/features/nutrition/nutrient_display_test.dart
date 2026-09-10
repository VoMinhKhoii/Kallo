import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/logic/nutrient_display.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

import 'nutrient_test_fixtures.dart';

/// The ONE definition of "met" — pinned per nutrient type, because a second
/// copy with identical thresholds once lived beside it and the two were used
/// interchangeably in the same file.
NutrientCardData _card({
  required NutrientType type,
  required double? pct,
  double confidence = 100,
}) => sodiumCard(
  nutrientType: type,
  averagePerDay: pct == null ? null : pct * 20,
  percentOfTarget: pct,
  confidence: confidence,
);

void main() {
  group('isOnTarget', () {
    test('a floor is met from 90% up, with no ceiling', () {
      expect(isOnTarget(_card(type: NutrientType.floor, pct: 89.9)), isFalse);
      expect(isOnTarget(_card(type: NutrientType.floor, pct: 90)), isTrue);
      expect(isOnTarget(_card(type: NutrientType.floor, pct: 250)), isTrue);
    });

    test('a ceiling is met only inside 90..100', () {
      expect(isOnTarget(_card(type: NutrientType.ceiling, pct: 89.9)), isFalse);
      expect(isOnTarget(_card(type: NutrientType.ceiling, pct: 90)), isTrue);
      expect(isOnTarget(_card(type: NutrientType.ceiling, pct: 100)), isTrue);
      expect(
        isOnTarget(_card(type: NutrientType.ceiling, pct: 100.1)),
        isFalse,
      );
    });

    test('a range is met within ±10%', () {
      expect(isOnTarget(_card(type: NutrientType.range, pct: 89.9)), isFalse);
      expect(isOnTarget(_card(type: NutrientType.range, pct: 90)), isTrue);
      expect(isOnTarget(_card(type: NutrientType.range, pct: 110)), isTrue);
      expect(isOnTarget(_card(type: NutrientType.range, pct: 110.1)), isFalse);
    });

    test('no reading is never met', () {
      expect(isOnTarget(_card(type: NutrientType.floor, pct: null)), isFalse);
    });
  });

  group('showChips', () {
    test('needs confidence and a meaningful shortfall', () {
      expect(showChips(_card(type: NutrientType.floor, pct: 60)), isTrue);
      expect(showChips(_card(type: NutrientType.floor, pct: 95)), isFalse);
      expect(
        showChips(_card(type: NutrientType.floor, pct: 60, confidence: 30)),
        isFalse,
      );
      expect(showChips(_card(type: NutrientType.floor, pct: null)), isFalse);
    });
  });
}
