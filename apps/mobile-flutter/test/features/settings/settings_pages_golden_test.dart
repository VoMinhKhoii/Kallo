import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/screens/steps/about_you_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/cooking_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/goal_pace_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/region_page.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../golden_tolerance.dart';
import '../../l10n_test_loader.dart';
import '../onboarding/onboarding_test_support.dart';

/// Pixel record of the Settings pages that ARE onboarding steps, at the
/// 390×844 phone they were designed on, in the language that exposed the
/// original clipping. The step bodies' values are unit-tested; what only a
/// picture holds is the frame — the inline bar, the rhythm, the wrapping hint
/// lines and the portion drawings.

const _profile = <String, dynamic>{
  'biologicalSex': 'male',
  'weightKg': '68.5',
  'heightCm': 172,
  'age': 29,
  'activityLevel': 'moderate',
  'goal': 'cutting',
  'aggression': '0.5',
  'carbSplit': 'moderate_carb',
  'calorieTarget': 1800,
  'oilUsage': 'normal',
  'defaultRicePortion': 'medium',
  'defaultProteinPortion': 'medium',
  'brothConsumption': 'some',
  'countryOfOrigin': 'Vietnam',
  'countryOfResidence': 'Vietnam',
  'preferredLocale': 'vi',
};

Widget _host(Widget page, {Map<String, dynamic> profile = _profile}) =>
    ProviderScope(
      overrides: [
        profileProvider.overrideWith((ref) async => ProfileRow(profile)),
      ],
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        startLocale: const Locale('vi'),
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: kalloAppTheme(),
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: page,
              ),
        ),
      ),
    );

Future<void> _shoot(
  WidgetTester tester,
  Widget page,
  String name, {
  Map<String, dynamic> profile = _profile,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_host(page, profile: profile));
  await tester.pumpAndSettle();
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
}
