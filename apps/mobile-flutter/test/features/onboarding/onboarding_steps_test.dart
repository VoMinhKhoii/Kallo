// The six screens are plain views over one mutable [OnboardingAnswers], so
// each can be pumped on its own — no Riverpod, no sink, no wizard.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_goal.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_language.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_origin.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_target.dart';
import 'package:kallo_mobile/features/onboarding/widgets/pace_ruler.dart';
import 'package:kallo_mobile/shared/widgets/form/option_row.dart';

import 'onboarding_test_support.dart';

/// Pumps [build] under the l10n host, rebuilding it whenever its answers
/// change — the wizard's own `onChanged` contract.
Future<void> _pump(
  WidgetTester tester,
  Widget Function(VoidCallback rebuild) build,
) async {
  await tester.pumpWidget(
    localizedHome(
      Scaffold(
        body: SafeArea(
          child: StatefulBuilder(
            builder: (context, setState) => Padding(
              padding: const EdgeInsets.all(24),
              child: SingleChildScrollView(
                child: build(() => setState(() {})),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The labels of every [OptionRow] on screen, in order.
List<String> _rowLabels(WidgetTester tester) => tester
    .widgetList<OptionRow>(find.byType(OptionRow))
    .map((row) => row.label)
    .toList();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(initOnboardingTest);

  group('screen 1 — language', () {
    testWidgets('picking a row switches the app locale immediately',
        (tester) async {
      final answers = testAnswers();
      await _pump(
        tester,
        (rebuild) => StepLanguage(
          answers: answers,
          deviceLanguage: 'en',
          localeFromDevice: true,
          onChanged: rebuild,
        ),
      );

      // The English row opened selected and is the one the phone guessed.
      expect(find.text('From your phone'), findsOneWidget);
      expect(find.text('Change anytime in Settings.'), findsOneWidget);

      await tester.tap(find.text('Tiếng Việt'));
      await tester.pumpAndSettle();

      expect(answers.preferredLocale, 'vi');
      // The meta line is the proof the whole app moved, not just the field.
      expect(
        find.text('Có thể đổi bất cứ lúc nào trong Cài đặt.'),
        findsOneWidget,
      );
    });

    testWidgets('a saved locale carries no "from your phone" note',
        (tester) async {
      await _pump(
        tester,
        (rebuild) => StepLanguage(
          answers: testAnswers(locale: 'vi'),
          deviceLanguage: 'vi',
          localeFromDevice: false,
          onChanged: rebuild,
        ),
      );
      expect(find.text('From your phone'), findsNothing);
    });
  });

  group('screen 2 — where you cook', () {
    Future<void> origin(WidgetTester tester, OnboardingAnswers answers) =>
        _pump(
          tester,
          (rebuild) => StepOrigin(
            answers: answers,
            deviceCountry: 'Australia',
            onChanged: rebuild,
          ),
        );

    testWidgets('suggests the device region, then Việt Nam, then the language',
        (tester) async {
      await origin(tester, testAnswers(origin: 'Australia'));

      expect(_rowLabels(tester), [
        'Australia',
        'Vietnam',
        'United States',
        'United Kingdom',
      ]);
      // Only the phone's own guess is noted, and it is preselected.
      expect(find.text('From your phone'), findsOneWidget);
      final australia = tester.widget<OptionRow>(find.byType(OptionRow).first);
      expect(australia.selected, isTrue);
      expect(australia.note, 'From your phone');
    });

    testWidgets('the suggestions follow the language picked on screen 1, not '
        'the phone\'s', (tester) async {
      // A `late final` off the device language froze the English-market rows
      // out for anyone who changed the language one screen earlier.
      final answers = testAnswers(locale: 'vi', origin: 'Australia');
      await origin(tester, answers);
      expect(_rowLabels(tester), ['Australia', 'Vietnam']);

      answers.preferredLocale = 'en';
      await origin(tester, answers);
      expect(_rowLabels(tester), [
        'Australia',
        'Vietnam',
        'United States',
        'United Kingdom',
      ]);
    });

    testWidgets('typing filters both blocks, ignoring case and diacritics',
        (tester) async {
      await origin(tester, testAnswers(origin: 'Australia'));

      // "viet" has no accents and no capital; the row it must find has both.
      await tester.enterText(find.byType(TextField).first, 'viet');
      await tester.pumpAndSettle();
      expect(_rowLabels(tester), ['Vietnam']);
      expect(find.text('All countries'), findsNothing);

      // A name only the Vietnamese column carries.
      await tester.enterText(find.byType(TextField).first, 'duc');
      await tester.pumpAndSettle();
      expect(_rowLabels(tester), isEmpty);
      expect(find.text('Germany'), findsOneWidget);
    });

    testWidgets('the residence line names the phone\'s country', (tester) async {
      await origin(tester, testAnswers(origin: 'Australia', residence: 'Australia'));
      expect(
        find.text('Living in Australia · from your phone'),
        findsOneWidget,
      );
      expect(find.text('Change'), findsOneWidget);
    });

    testWidgets('a residence the user corrected no longer credits the phone',
        (tester) async {
      await origin(tester, testAnswers(origin: 'Australia', residence: 'Germany'));

      expect(find.text('Living in Germany'), findsOneWidget);
      expect(
        find.text('Living in Germany · from your phone'),
        findsNothing,
        reason: 'the phone guessed Australia, not Germany',
      );
    });
  });

  group('screen 4 — goal', () {
    Future<void> goal(WidgetTester tester, OnboardingAnswers answers) =>
        _pump(tester, (rebuild) => StepGoal(answers: answers, onChanged: rebuild));

    testWidgets('maintaining hides the pace ruler; a goal brings it back',
        (tester) async {
      final answers = testAnswers();
      await goal(tester, answers);
      expect(find.byType(PaceRuler), findsNothing);

      await tester.tap(find.text('Cutting'));
      await tester.pumpAndSettle();

      expect(answers.goal, Goal.cutting);
      expect(find.byType(PaceRuler), findsOneWidget);
      expect(find.text('Pace'), findsOneWidget);
      expect(find.text('0.5 kg a week · 550 kcal deficit'), findsOneWidget);
      expect(find.text('Gentle'), findsOneWidget);
      expect(find.text('Aggressive'), findsOneWidget);
    });

    testWidgets('bulking reads out a surplus, not a deficit', (tester) async {
      await goal(tester, testAnswers(goal: Goal.bulking));
      expect(find.text('0.5 kg a week · 550 kcal surplus'), findsOneWidget);
    });
  });

  group('screen 6 — daily target', () {
    testWidgets('every figure recomputes when the carb split changes',
        (tester) async {
      final answers = testAnswers();
      await _pump(
        tester,
        (rebuild) => StepTarget(answers: answers, onChanged: rebuild),
      );

      final moderate = answers.targets!;
      expect(find.text('${moderate.proteinG.round()} g'), findsOneWidget);
      expect(find.text('30 / 35 / 35'), findsOneWidget);

      await tester.tap(find.text('Higher carb'));
      await tester.pumpAndSettle();

      expect(answers.carbSplit, CarbSplit.higherCarb);
      final higher = answers.targets!;
      // Same calories, redistributed: more carbs, far less fat.
      expect(higher.calories, moderate.calories);
      expect(higher.carbsG, greaterThan(moderate.carbsG));
      expect(find.text('${higher.carbsG.round()} g'), findsOneWidget);
      expect(find.text('${moderate.fatG.round()} g'), findsNothing);
    });

    testWidgets('no metrics means the unlock copy, not a fabricated target',
        (tester) async {
      await _pump(
        tester,
        (rebuild) =>
            StepTarget(answers: testAnswers(body: false), onChanged: rebuild),
      );
      expect(find.text('Fill the basics to unlock targets.'), findsOneWidget);
      expect(find.text('Carb split'), findsNothing);
    });
  });
}
