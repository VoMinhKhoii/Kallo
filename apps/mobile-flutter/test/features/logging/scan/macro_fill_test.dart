import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/scan/macro_fill.dart';

/// Any three of calories, protein, carbs and fat give the fourth, by the
/// 4 / 4 / 9 kcal a gram of protein, carbs and fat hold.
void main() {
  const full = {
    'calories': 250.0,
    'proteinGrams': 10.0,
    'carbsGrams': 30.0,
    'fatGrams': 10.0,
  };

  Map<String, double?> without(String key) => {...full, key: null};

  test('calories from the three macros, whole', () {
    expect(fillMissingMacro(without('calories')), (
      key: 'calories',
      value: 250.0,
    ));
    expect(
      fillMissingMacro({...without('calories'), 'fatGrams': 2.35})?.value,
      181,
      reason: '40 + 120 + 21.15',
    );
  });

  test('a macro from the calories and the other two, to one decimal', () {
    expect(fillMissingMacro(without('fatGrams')), (
      key: 'fatGrams',
      value: 10.0,
    ));
    expect(fillMissingMacro(without('proteinGrams')), (
      key: 'proteinGrams',
      value: 10.0,
    ));
    expect(
      fillMissingMacro({...without('carbsGrams'), 'calories': 251})?.value,
      30.3,
      reason: '(251 - 40 - 90) / 4 = 30.25',
    );
  });

  test('nothing when more or less than one is missing', () {
    expect(fillMissingMacro(full), isNull);
    expect(
      fillMissingMacro({...without('fatGrams'), 'carbsGrams': null}),
      isNull,
    );
  });

  test('nothing when the macros already hold more than the calories', () {
    expect(
      fillMissingMacro({...without('fatGrams'), 'calories': 100}),
      isNull,
      reason: '40 + 120 > 100: fat would be negative',
    );
  });
}
