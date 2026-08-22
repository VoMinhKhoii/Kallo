import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/models/profile/onboarding.dart';
import 'package:kallo_mobile/shared/logic/tdee.dart';

/// `lib/shared/logic/tdee.dart` is the Dart end of a THREE-way vendored
/// calculation: web `lib/domain/onboarding/tdee.ts` is the source, and until
/// this consolidation the Flutter app carried two independent copies of it
/// (onboarding and settings), each with its own inlined constant tables. One
/// BMR change needed three edits, and nothing failed when only two happened.
///
/// The behavioural group below pins the maths. The parity group reads the
/// TypeScript off disk and asserts the numbers still agree — the same trick
/// `test/portion_vessel_assets_test.dart` plays for the vessel tables, and for
/// the same reason: without it each side stays internally consistent while the
/// two clients quietly compute different calorie targets for the same user.

final _webTdee = File('../../lib/domain/onboarding/tdee.ts');
final _webConstants = File('../../lib/domain/onboarding/constants.ts');

bool _webPresent() => _webTdee.existsSync() && _webConstants.existsSync();

String _snake(String camel) => camel.replaceAllMapped(
  RegExp('[A-Z]'),
  (m) => '_${m.group(0)!.toLowerCase()}',
);

double _bmr({
  BiologicalSex sex = BiologicalSex.male,
  double weightKg = 70,
  int heightCm = 175,
  int age = 30,
}) => calcBMR(
  biologicalSex: sex,
  weightKg: weightKg,
  heightCm: heightCm,
  age: age,
);

void main() {
  group('calcBMR', () {
    test('applies the male Mifflin–St Jeor offset (+5)', () {
      // 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5
      expect(_bmr(), closeTo(1648.75, 1e-9));
    });

    test('applies the female offset (−161)', () {
      expect(_bmr(sex: BiologicalSex.female), closeTo(1648.75 - 166, 1e-9));
    });

    test('does not round — rounding belongs to TDEE and the macros', () {
      final bmr = _bmr(weightKg: 70.4);
      expect(bmr, isNot(equals(bmr.roundToDouble())));
    });

  });

  // The whole chain, once: the two former copies each had their own, and this
  // is the arithmetic a wrong constant table would actually corrupt.
  group('BMR → TDEE → targets', () {
    test('carries a 70kg/175cm/30y male cutting at 0.5 kg/wk end to end', () {
      final bmr = _bmr(); // 1648.75
      final tdee = calcTDEE(bmr, ActivityLevel.light); // ×1.375 → 2267
      expect(tdee, 2267);
      final targets = calcDailyTargets(
        tdee,
        Goal.cutting,
        0.5,
        CarbSplit.moderateCarb,
      );
      expect(targets.calories, 1717); // 2267 − 550
      expect(targets.proteinG, 129);
      expect(targets.carbsG, 150);
      expect(targets.fatG, 67);
    });
  });

  group('calcTDEE', () {
    test('multiplies by the activity multiplier and rounds', () {
      expect(calcTDEE(1648.75, ActivityLevel.sedentary), 1979); // ×1.2
      expect(calcTDEE(1648.75, ActivityLevel.light), 2267); // ×1.375
      expect(calcTDEE(1648.75, ActivityLevel.moderate), 2556); // ×1.55
      expect(calcTDEE(1648.75, ActivityLevel.veryActive), 2844); // ×1.725
    });
  });

  group('calcMacroGrams', () {
    test('splits calories by ratio at 4/4/9 kcal per gram', () {
      final m = calcMacroGrams(2000, CarbSplit.moderateCarb);
      expect(m.calories, 2000);
      expect(m.proteinG, 150); // 2000 * 30% / 4
      expect(m.carbsG, 175); // 2000 * 35% / 4
      expect(m.fatG, 78); // 2000 * 35% / 9 = 77.78
    });

    test('honours each split table', () {
      expect(calcMacroGrams(2000, CarbSplit.lowerCarb).carbsG, 100);
      expect(calcMacroGrams(2000, CarbSplit.higherCarb).carbsG, 250);
    });

    test('rounds the calorie figure it echoes back', () {
      expect(calcMacroGrams(1999.6, CarbSplit.moderateCarb).calories, 2000);
    });
  });

  group('calcDailyTargets', () {
    test('maintaining leaves the TDEE untouched', () {
      final m = calcDailyTargets(2200, Goal.maintaining, 0.5, CarbSplit.moderateCarb);
      expect(m.calories, 2200);
    });

    test('maintaining ignores aggression entirely', () {
      expect(
        calcDailyTargets(2200, Goal.maintaining, 0.8, CarbSplit.moderateCarb).calories,
        calcDailyTargets(2200, Goal.maintaining, null, CarbSplit.moderateCarb).calories,
      );
    });

    test('cutting subtracts aggression × kcal-per-kg', () {
      // 0.5 kg/week × 1100 = 550
      expect(
        calcDailyTargets(2200, Goal.cutting, 0.5, CarbSplit.moderateCarb).calories,
        1650,
      );
    });

    test('bulking adds the same adjustment', () {
      expect(
        calcDailyTargets(2200, Goal.bulking, 0.5, CarbSplit.moderateCarb).calories,
        2750,
      );
    });

    test('treats a null aggression as zero', () {
      expect(
        calcDailyTargets(2200, Goal.cutting, null, CarbSplit.moderateCarb).calories,
        2200,
      );
    });

    test('rounds the aggression adjustment before applying it', () {
      // 0.35 × 1100 = 385.00000000000006 → 385, not 385.00000000000006
      expect(
        calcDailyTargets(2200, Goal.cutting, 0.35, CarbSplit.moderateCarb).calories,
        1815,
      );
    });

    test('deficitOverride wins over the aggression maths', () {
      expect(
        calcDailyTargets(2200, Goal.cutting, 0.5, CarbSplit.moderateCarb, 300).calories,
        1900,
      );
    });

    test('accepts a fractional deficitOverride as well as an int', () {
      // The two pre-consolidation copies typed this parameter differently
      // (double? in onboarding, int? in settings); `num?` accepts both.
      expect(
        calcDailyTargets(2200, Goal.cutting, 0.5, CarbSplit.moderateCarb, 300.4).calories,
        1900, // 1899.6 rounded by calcMacroGrams
      );
    });

    test('lets calories go negative — the server clamps, not this function', () {
      expect(
        calcDailyTargets(400, Goal.cutting, 0.8, CarbSplit.moderateCarb).calories,
        lessThan(0),
      );
    });
  });

  group('web parity', () {
    // Skipped in a standalone Flutter checkout; in the monorepo it always runs.
    test('shares the activity multipliers with the web constants', () {
      if (!_webPresent()) {
        markTestSkipped('web onboarding sources not present');
        return;
      }
      final source = _webConstants.readAsStringSync();
      final block = RegExp(
        r'ACTIVITY_MULTIPLIERS[^{]*\{([^}]*)\}',
      ).firstMatch(source);
      expect(block, isNotNull, reason: 'ACTIVITY_MULTIPLIERS missing from web');
      for (final level in ActivityLevel.values) {
        final match = RegExp(
          '${_snake(level.name)}:\\s*([0-9.]+)',
        ).firstMatch(block!.group(1)!);
        expect(match, isNotNull, reason: '${level.name} missing from web table');
        expect(
          double.parse(match!.group(1)!),
          kActivityMultipliers[level],
          reason: '${level.name} multiplier drifted from the web declaration',
        );
      }
    });

    test('shares the carb-split ratios with the web constants', () {
      if (!_webPresent()) {
        markTestSkipped('web onboarding sources not present');
        return;
      }
      final source = _webConstants.readAsStringSync();
      for (final split in CarbSplit.values) {
        final match = RegExp(
          '${_snake(split.name)}:\\s*\\{\\s*protein:\\s*(\\d+),\\s*'
          'fat:\\s*(\\d+),\\s*carbs:\\s*(\\d+)\\s*\\}',
        ).firstMatch(source);
        expect(match, isNotNull, reason: '${split.name} missing from web table');
        final ratio = kCarbSplitRatios[split]!;
        expect(
          [
            int.parse(match!.group(1)!),
            int.parse(match.group(2)!),
            int.parse(match.group(3)!),
          ],
          [ratio.protein, ratio.fat, ratio.carbs],
          reason: '${split.name} ratio drifted from the web declaration',
        );
      }
    });

    test('shares the aggression kcal-per-kg with the web constants', () {
      if (!_webPresent()) {
        markTestSkipped('web onboarding sources not present');
        return;
      }
      final match = RegExp(
        r'AGGRESSION_KCAL_PER_KG\s*=\s*(\d+)',
      ).firstMatch(_webConstants.readAsStringSync());
      expect(match, isNotNull, reason: 'AGGRESSION_KCAL_PER_KG missing');
      expect(int.parse(match!.group(1)!), kAggressionKcalPerKg);
    });

    test('shares the Mifflin–St Jeor coefficients with the web formula', () {
      if (!_webPresent()) {
        markTestSkipped('web onboarding sources not present');
        return;
      }
      final source = _webTdee.readAsStringSync();
      // `10 * kg + 6.25 * cm - 5 * age`, then `+ 5` male / `- 161` female.
      expect(
        source,
        contains('10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.age'),
        reason: 'the web BMR base formula changed shape — re-verify calcBMR',
      );
      expect(
        RegExp(r"=== 'male' \? base \+ 5 : base - 161").hasMatch(source),
        isTrue,
        reason: 'the web BMR sex offsets changed — re-verify calcBMR',
      );
    });

    test('shares the kcal-per-gram divisors with the web macro split', () {
      if (!_webPresent()) {
        markTestSkipped('web onboarding sources not present');
        return;
      }
      final source = _webTdee.readAsStringSync();
      for (final (macro, divisor) in [
        ('protein', 4),
        ('carbs', 4),
        ('fat', 9),
      ]) {
        expect(
          source,
          contains('(calories * ratio.$macro) / 100 / $divisor'),
          reason: '$macro kcal-per-gram drifted from the web declaration',
        );
      }
    });
  });
}
