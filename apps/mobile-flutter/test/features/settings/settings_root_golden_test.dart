import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';

import '../../golden_tolerance.dart';
import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// Pixel record of the settings root's "Hồ sơ dinh dưỡng" group — one row per
/// onboarding step, each saying what its page holds — for a set-up profile
/// and for one where nothing was ever answered.

Future<void> _shoot(
  WidgetTester tester,
  Map<String, dynamic> raw,
  String name,
) async {
  await pumpSettingsPage(
    tester,
    const SettingsScreen(),
    overrides: [
      currentSessionProvider.overrideWithValue(testSession()),
      profileProvider.overrideWith((ref) async => ProfileRow(raw)),
      onboardingResumeProvider.overrideWithValue(false),
      subscriptionSectionVisibleProvider.overrideWithValue(false),
    ],
  );
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
    await _shoot(tester, kFullProfile, 'settings_root_profile_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('nutrition profile — nothing answered yet, vi', (tester) async {
    await _shoot(tester, const {}, 'settings_root_profile_blank_vi');
  }, skip: skipOffGoldenPlatform);
}
