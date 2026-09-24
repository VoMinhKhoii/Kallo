import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart'
    as onboarding;
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart'
    as onboarding;
import 'package:kallo_mobile/features/settings/data/profile_providers.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../golden_tolerance.dart';
import '../../l10n_test_loader.dart';
import '../onboarding/onboarding_test_support.dart';

/// Pixel record of the settings root's "Hồ sơ dinh dưỡng" group — one row per
/// onboarding step, each saying what its page holds — for a set-up profile
/// and for one where nothing was ever answered.

const _full = <String, dynamic>{
  'biologicalSex': 'male',
  'weightKg': '68.5',
  'heightCm': 172,
  'age': 29,
  'goal': 'cutting',
  'aggression': '0.5',
  'calorieTarget': 1800,
  'oilUsage': 'normal',
  'defaultRicePortion': 'medium',
  'defaultProteinPortion': 'medium',
  'brothConsumption': 'some',
  'countryOfResidence': 'Vietnam',
  'preferredLocale': 'vi',
  'onboardingCompletedAt': '2026-09-01T00:00:00.000Z',
};

Widget _host(Map<String, dynamic> raw) => ProviderScope(
  overrides: [
    currentSessionProvider.overrideWithValue(testSession()),
    profileProvider(true).overrideWith((ref) async => ProfileRow(raw)),
    onboarding.profileProvider.overrideWith(
      (ref) async => onboarding.ProfileRow(raw),
    ),
    onboarding.onboardingResumeProvider.overrideWithValue(false),
    subscriptionSectionVisibleProvider.overrideWithValue(false),
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
            home: const SettingsScreen(),
          ),
    ),
  ),
);

Future<void> _shoot(
  WidgetTester tester,
  Map<String, dynamic> raw,
  String name,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_host(raw));
  await tester.pumpAndSettle();
  // The group's card: the one holding the body-metrics row.
  final card = find.ancestor(
    of: find.text(tr('settings.rows.aboutYou')),
    matching: find.byType(GroupedListCard),
  );
  await expectLater(card, matchesGoldenFile('goldens/$name.png'));
}

void main() {
  setUpAll(() => initOnboardingTest(fonts: false));
  setUpGoldens();

  testWidgets('nutrition profile — set up, vi', (tester) async {
    await _shoot(tester, _full, 'settings_root_profile_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('nutrition profile — nothing answered yet, vi', (tester) async {
    await _shoot(tester, const {}, 'settings_root_profile_blank_vi');
  }, skip: skipOffGoldenPlatform);
}
