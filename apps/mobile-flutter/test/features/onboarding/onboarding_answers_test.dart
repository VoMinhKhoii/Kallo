// The wizard's derived numbers: the target the card SHOWS and the payload it
// STORES come from the same getter, so anything true of one is true of both.
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/shared/logic/tdee.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import 'onboarding_test_support.dart';

void main() {
  group('the 500 kcal floor', () {
    // Every value here passes validation — 30 kg, 100 cm, 100 yr are the
    // schema's own bounds — and the raw arithmetic is NEGATIVE: a 317 kcal
    // TDEE against an 880 kcal/day deficit.
    OnboardingAnswers steepestCut() => testAnswers(
          sex: BiologicalSex.female,
          weight: 30,
          height: 100,
          age: 100,
          activity: ActivityLevel.sedentary,
          goal: Goal.cutting,
          aggression: 0.8,
        );

    test('the smallest in-range body on the steepest cut lands ON the floor, '
        'with macros to match', () {
      final answers = steepestCut();

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
      final answers = steepestCut();
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
      final answers = testAnswers(
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
      final answers = testAnswers(goal: Goal.cutting, deficitOverride: 300);
      final tdee = answers.tdeeKcal!;

      expect(answers.targets!.calories, tdee - 300);
      expect(answers.stepTwoValues!.calorieTarget, tdee - 300);
    });

    test('and in the pace readout, so the two agree', () {
      // Without this the ruler would still read "550 kcal deficit" beside a
      // card showing a 300 kcal one.
      expect(testAnswers(goal: Goal.cutting, deficitOverride: 300).paceKcal, 300);
    });

    test('is posted back unchanged', () {
      expect(
        testAnswers(goal: Goal.cutting, deficitOverride: 300)
            .stepTwoValues!
            .deficitOverride,
        300,
      );
    });
  });

  group('aggression', () {
    test('maintaining stores none — web parity with `Aggression | null`', () {
      final answers = testAnswers(goal: Goal.maintaining, aggression: 0.7);

      expect(answers.paceKcal, 0);
      expect(answers.targets!.calories, answers.tdeeKcal);
      expect(answers.stepTwoValues!.aggression, isNull);
      expect(answers.stepTwoValues!.toJson()['aggression'], isNull);
    });

    test('a goal with a pace stores it', () {
      expect(
        testAnswers(goal: Goal.cutting, aggression: 0.7).stepTwoValues!.aggression,
        0.7,
      );
    });
  });

  test('incomplete metrics have no target and nothing to post', () {
    final answers = testAnswers()..weightKg = null;
    expect(answers.hasTargets, isFalse);
    expect(answers.targets, isNull);
    expect(answers.stepTwoValues, isNull);
  });

  group('the goal the body implies', () {
    // 1.75 m: 55 kg is BMI 18.0, 70 kg is 22.9, 72 kg is 23.5, 80 kg is 26.1.
    OnboardingAnswers body(double weight, {String? origin}) =>
        testAnswers(weight: weight, height: 175, origin: origin)
          ..goalChosenByUser = false
          ..goal = Goal.maintaining;

    void expectGoal(OnboardingAnswers answers, Goal expected) {
      answers.applyDefaultGoal();
      expect(answers.goal, expected);
    }

    test('underweight opens on bulking, healthy on maintaining', () {
      expectGoal(body(55), Goal.bulking);
      expectGoal(body(70), Goal.maintaining);
      expectGoal(body(80), Goal.cutting);
    });

    test('an Asian origin moves the overweight action point to 23', () {
      // WHO 2004: the same 23.5 that is healthy for the general cutoff is
      // already the action point for the population the cutoff was written
      // for — and it is read off the ORIGIN, not the country of residence.
      expectGoal(body(72), Goal.maintaining);
      expectGoal(body(72, origin: 'Vietnam'), Goal.cutting);
      expectGoal(body(72, origin: 'Germany'), Goal.maintaining);
    });

    test('an incomplete or out-of-range body leaves the goal alone', () {
      final blank = testAnswers(body: false)..goal = Goal.maintaining;
      expectGoal(blank, Goal.maintaining);
      final absurd = body(5000);
      expectGoal(absurd, Goal.maintaining);
    });

    test('once the user picks, the default stops tracking the body', () {
      final answers = body(80)..goalChosenByUser = true;
      expectGoal(answers, Goal.maintaining);
    });
  });

  group('what screen 6 is still waiting on', () {
    test('names the absent inputs, and nothing when they are all there', () {
      expect(testAnswers().missingTargetInputs, isEmpty);
      expect(
        testAnswers(body: false).missingTargetInputs,
        {
          TargetInput.biologicalSex,
          TargetInput.weightKg,
          TargetInput.heightCm,
          TargetInput.age,
        },
      );
      expect(testAnswers(age: null).missingTargetInputs, {TargetInput.age});
    });
  });
}
