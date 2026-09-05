// The wizard's derived numbers: the target the card SHOWS and the payload it
// STORES come from the same getter, so anything true of one is true of both.
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/shared/logic/tdee.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

OnboardingAnswers _answers({
  BiologicalSex? sex = BiologicalSex.male,
  double weight = 70,
  int height = 175,
  int age = 30,
  ActivityLevel activity = ActivityLevel.light,
  Goal goal = Goal.maintaining,
  double? aggression = 0.5,
  CarbSplit carbSplit = CarbSplit.moderateCarb,
  double? deficitOverride,
}) =>
    OnboardingAnswers(
      preferredLocale: 'en',
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Vietnam',
      biologicalSex: sex,
      weightKg: weight,
      heightCm: height,
      age: age,
      activityLevel: activity,
      goal: goal,
      aggression: aggression,
      carbSplit: carbSplit,
      deficitOverride: deficitOverride,
      cooking: const CookingHabits(
        oilUsage: OilUsage.normal,
        defaultRicePortion: RicePortion.medium,
        sugarBraised: SugarBraised.medium,
        defaultProteinPortion: ProteinPortion.medium,
        brothConsumption: BrothConsumption.some,
      ),
    );

void main() {
  group('the 500 kcal floor', () {
    test('the smallest in-range body on the steepest cut lands ON the floor, '
        'with macros to match', () {
      // Every value here passes validation — 30 kg, 100 cm, 100 yr are the
      // schema's own bounds — and the raw arithmetic is NEGATIVE: a 317 kcal
      // TDEE against an 880 kcal/day deficit.
      final answers = _answers(
        sex: BiologicalSex.female,
        weight: 30,
        height: 100,
        age: 100,
        activity: ActivityLevel.sedentary,
        goal: Goal.cutting,
        aggression: 0.8,
      );

      expect(answers.tdeeKcal, 317);
      final targets = answers.targets!;
      expect(targets.calories, 500);
      expect(targets.proteinG, greaterThan(0));
      expect(targets.carbsG, greaterThan(0));
      expect(targets.fatG, greaterThan(0));
      // The grams are re-derived FROM the clamped figure, so they still add up
      // to it rather than describing the negative number underneath.
      final expected = calcMacroGrams(500, CarbSplit.moderateCarb);
      expect(targets.proteinG, expected.proteinG);
      expect(targets.carbsG, expected.carbsG);
      expect(targets.fatG, expected.fatG);
    });

    test('the payload posts exactly what the card showed', () {
      final answers = _answers(
        sex: BiologicalSex.female,
        weight: 30,
        height: 100,
        age: 100,
        activity: ActivityLevel.sedentary,
        goal: Goal.cutting,
        aggression: 0.8,
      );
      final values = answers.stepTwoValues!;
      final shown = answers.targets!;

      expect(values.calorieTarget, 500);
      expect(values.proteinTargetG, shown.proteinG.round());
      expect(values.carbsTargetG, shown.carbsG.round());
      expect(values.fatTargetG, shown.fatG.round());
      expect(values.tdeeKcal, 317);
    });

    test('the biggest in-range body on the steepest bulk is untouched by it',
        () {
      final answers = _answers(
        weight: 300,
        height: 250,
        age: 13,
        activity: ActivityLevel.sedentary,
        goal: Goal.bulking,
        aggression: 0.8,
      );

      final tdee = answers.tdeeKcal!;
      expect(tdee, 5403);
      expect(answers.targets!.calories, tdee + 880);
      expect(answers.paceKcal, 880);
    });
  });

  group('deficitOverride', () {
    test('replaces the pace-derived adjustment in the target', () {
      final answers = _answers(goal: Goal.cutting, deficitOverride: 300);
      final tdee = answers.tdeeKcal!;

      expect(answers.targets!.calories, tdee - 300);
      expect(answers.stepTwoValues!.calorieTarget, tdee - 300);
    });

    test('and in the pace readout, so the two agree', () {
      // Without this the ruler would still read "550 kcal deficit" beside a
      // card showing a 300 kcal one.
      expect(_answers(goal: Goal.cutting, deficitOverride: 300).paceKcal, 300);
    });

    test('is posted back unchanged', () {
      expect(
        _answers(goal: Goal.cutting, deficitOverride: 300)
            .stepTwoValues!
            .deficitOverride,
        300,
      );
    });
  });

  group('aggression', () {
    test('maintaining stores none — web parity with `Aggression | null`', () {
      final answers = _answers(goal: Goal.maintaining, aggression: 0.7);

      expect(answers.paceKcal, 0);
      expect(answers.targets!.calories, answers.tdeeKcal);
      expect(answers.stepTwoValues!.aggression, isNull);
      expect(answers.stepTwoValues!.toJson()['aggression'], isNull);
    });

    test('a goal with a pace stores it', () {
      expect(
        _answers(goal: Goal.cutting, aggression: 0.7).stepTwoValues!.aggression,
        0.7,
      );
    });
  });

  test('incomplete metrics have no target and nothing to post', () {
    final answers = _answers()..weightKg = null;
    expect(answers.hasTargets, isFalse);
    expect(answers.targets, isNull);
    expect(answers.stepTwoValues, isNull);
  });
}
