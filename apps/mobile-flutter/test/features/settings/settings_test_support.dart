import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../l10n_test_loader.dart';

/// A fully set-up profile row, as `GET /api/v1/onboarding/profile` returns
/// it — decimals as strings, the way the DB hands them back.
const kFullProfile = <String, dynamic>{
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
  'onboardingCompletedAt': '2026-09-01T00:00:00.000Z',
};

/// Pumps [home] in the app's theme, in Vietnamese, on the 390×844 phone the
/// settings pages were designed on, and lets it settle.
Future<void> pumpSettingsPage(
  WidgetTester tester,
  Widget home, {
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
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
                home: home,
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}
