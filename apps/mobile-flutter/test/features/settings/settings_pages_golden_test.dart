import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_goal.dart';
import 'package:kallo_mobile/features/settings/screens/steps/about_you_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/cooking_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/goal_pace_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/region_page.dart';

import '../../golden_tolerance.dart';
import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// Pixel record of the Settings pages that ARE onboarding steps, at the
/// 390×844 phone they were designed on, in the language that exposed the
/// original clipping. The step bodies' values are unit-tested; what only a
/// picture holds is the frame — the inline bar, the rhythm, the wrapping hint
/// lines and the portion drawings.

Future<void> _shoot(
  WidgetTester tester,
  Widget page,
  String name, {
  Map<String, dynamic> profile = kFullProfile,
}) async {
  await pumpSettingsPage(
    tester,
    page,
    overrides: [
      profileProvider.overrideWith((ref) async => ProfileRow(profile)),
    ],
  );
  // Decode the portion drawings for real before the frame is recorded.
  await tester.runAsync(() async {
    for (final image in tester.widgetList<Image>(find.byType(Image))) {
      await precacheImage(image.image, tester.element(find.byWidget(image)));
    }
  });
  await tester.pumpAndSettle();
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/$name.png'),
  );
}

void main() {
  setUpAll(() => initOnboardingTest(fonts: false));
  setUpGoldens();

  testWidgets('body metrics — vi', (tester) async {
    await _shoot(tester, const AboutYouPage(), 'settings_about_you_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('goal & pace — vi', (tester) async {
    await _shoot(tester, const GoalPacePage(), 'settings_goal_pace_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('goal & pace, no body yet — vi', (tester) async {
    await _shoot(
      tester,
      const GoalPacePage(),
      'settings_goal_pace_locked_vi',
      profile: const {'preferredLocale': 'vi'},
    );
  }, skip: skipOffGoldenPlatform);

  testWidgets('cooking — vi', (tester) async {
    await _shoot(tester, const CookingPage(), 'settings_cooking_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('region — vi', (tester) async {
    await _shoot(tester, const RegionPage(), 'settings_region_vi');
  }, skip: skipOffGoldenPlatform);

  Finder lockedGoal() => find.ancestor(
    of: find.byType(StepGoal),
    matching: find.byWidgetPredicate((w) => w is IgnorePointer && w.ignoring),
  );

  Future<void> openGoal(WidgetTester tester, Map<String, dynamic> row) =>
      pumpSettingsPage(
        tester,
        const GoalPacePage(),
        overrides: [
          profileProvider.overrideWith((ref) async => ProfileRow(row)),
        ],
      );

  testWidgets('the goal page is inert until the body is stored', (
    tester,
  ) async {
    // A legacy body with no activity level: the plan cannot be saved, so
    // its controls must not take an edit that would be dropped.
    await openGoal(tester, Map.of(kFullProfile)..remove('activityLevel'));
    expect(lockedGoal(), findsOneWidget);
    expect(find.text(tr('onboarding.target.fillMissing')), findsOneWidget);
  });

  testWidgets('with the body stored the goal page is live', (tester) async {
    await openGoal(tester, kFullProfile);
    expect(lockedGoal(), findsNothing);
  });
}
