import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/feedback/screens/feedback_screen.dart';
import 'package:kallo_mobile/features/settings/screens/account_delete_screen.dart';
import 'package:kallo_mobile/features/settings/screens/identity_section.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../../golden_tolerance.dart';
import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// Pixel record of the settings sub-pages that are not onboarding steps —
/// profile (with its photo sheet open), delete account and send feedback —
/// in Vietnamese, at the 390×844 phone they were designed on.

const _me = CircleProfile(
  userId: testUserId,
  handle: 'minhkhoi',
  displayName: 'Minh Khôi',
  hasCustomAvatar: true,
);

Future<void> _open(WidgetTester tester, Widget page) => pumpSettingsPage(
  tester,
  page,
  overrides: [myCircleProfileProvider.overrideWith((ref) async => _me)],
);

Future<void> _shoot(WidgetTester tester, String name) => expectLater(
  find.byType(MaterialApp),
  matchesGoldenFile('goldens/$name.png'),
);

void main() {
  setUpAll(() => initOnboardingTest(fonts: false));
  setUpGoldens();

  testWidgets('profile — vi', (tester) async {
    await _open(tester, const IdentityScreen());
    await _shoot(tester, 'settings_identity_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('profile, "Sửa ảnh" opens the photo sheet — vi', (tester) async {
    await _open(tester, const IdentityScreen());
    await tester.tap(find.text(tr('settings.identity.avatarEdit')));
    await tester.pumpAndSettle();
    expect(find.text(tr('settings.identity.avatarRemove')), findsOneWidget);
    await _shoot(tester, 'settings_identity_sheet_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('delete account — vi', (tester) async {
    await _open(tester, const AccountDeleteScreen());
    await _shoot(tester, 'settings_delete_account_vi');
  }, skip: skipOffGoldenPlatform);

  testWidgets('send feedback — vi', (tester) async {
    await _open(tester, const FeedbackScreen());
    await _shoot(tester, 'settings_feedback_vi');
  }, skip: skipOffGoldenPlatform);
}
