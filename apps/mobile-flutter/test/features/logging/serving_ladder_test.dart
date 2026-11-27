import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/serving_ladder.dart';

void main() {
  group('serving_ladder', () {
    test(
      'walks the exact sub-1 ladder down and back up, then +0.5 above 1',
      () {
        final down = <double>[];
        var v = 1.0;
        while (canStepServingMultiplier(v, -1)) {
          v = stepServingMultiplier(v, -1);
          down.add(v);
        }
        expect(down, [0.75, 2 / 3, 0.5, 1 / 3, 0.25]);
        expect(v, minServingMultiplier);
        expect(stepServingMultiplier(v, -1), 0.25);

        final up = <double>[];
        for (var i = 0; i < 8; i++) {
          v = stepServingMultiplier(v, 1);
          up.add(v);
        }
        expect(up, [1 / 3, 0.5, 2 / 3, 0.75, 1.0, 1.5, 2.0, 2.5]);
      },
    );

    test('snaps off-rung values to the next rung in either direction', () {
      expect(stepServingMultiplier(0.1, 1), 0.25);
      expect(stepServingMultiplier(0.3, 1), closeTo(1 / 3, 1e-9));
      expect(stepServingMultiplier(0.3, -1), 0.25);
      expect(stepServingMultiplier(0.4, 1), 0.5);
      expect(stepServingMultiplier(0.4, -1), closeTo(1 / 3, 1e-9));
      expect(stepServingMultiplier(0.6, 1), closeTo(2 / 3, 1e-9));
      expect(stepServingMultiplier(0.6, -1), 0.5);
      expect(stepServingMultiplier(0.8, 1), 1.0);
      expect(stepServingMultiplier(0.8, -1), 0.75);
      expect(stepServingMultiplier(1.06, 1), 1.5);
      expect(stepServingMultiplier(1.06, -1), 1.0);
      expect(stepServingMultiplier(1.475, 1), 1.5);
    });

    test('honors an upper bound when stepping up', () {
      expect(canStepServingMultiplier(1.5, 1, max: 1.6), isFalse);
      expect(stepServingMultiplier(1.5, 1, max: 1.6), 1.5);
      expect(canStepServingMultiplier(1.0, 1, max: 1.6), isTrue);
      expect(stepServingMultiplier(1.0, 1, max: 1.6), 1.5);
      expect(canStepServingMultiplier(1.0, 1, max: 1.0), isFalse);
      expect(canStepServingMultiplier(1.0, -1, max: 1.0), isTrue);
    });

    test('formats thirds as fractions and decimals by locale', () {
      expect(formatServingValue(0.25, 'en'), '0.25');
      expect(formatServingValue(1 / 3, 'en'), '1/3');
      expect(formatServingValue(0.333, 'en'), '1/3');
      expect(formatServingValue(0.5, 'en'), '0.5');
      expect(formatServingValue(2 / 3, 'en'), '2/3');
      expect(formatServingValue(0.667, 'en'), '2/3');
      expect(formatServingValue(0.75, 'en'), '0.75');
      expect(formatServingValue(1.0, 'en'), '1');
      expect(formatServingValue(1.5, 'en'), '1.5');

      expect(formatServingValue(0.25, 'vi'), '0,25');
      expect(formatServingValue(1 / 3, 'vi'), '1/3');
      expect(formatServingValue(0.5, 'vi'), '0,5');
      expect(formatServingValue(2 / 3, 'vi'), '2/3');
      expect(formatServingValue(0.75, 'vi'), '0,75');
      expect(formatServingTimes(0.25, 'vi'), '0,25×');
      expect(formatServingTimes(1 / 3, 'vi'), '1/3×');
    });

    test('picks singular up to 1 and plural above 1', () {
      expect(servingPluralCount(0.25), 1);
      expect(servingPluralCount(1 / 3), 1);
      expect(servingPluralCount(0.5), 1);
      expect(servingPluralCount(1.0), 1);
      expect(servingPluralCount(1.5), 2);
      expect(servingPluralCount(2.0), 2);
    });
  });
}
