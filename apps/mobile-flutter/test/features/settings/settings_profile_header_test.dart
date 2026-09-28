import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_manage_screen.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/screens/identity_section.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/features/settings/widgets/profile/settings_profile_header.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../golden_tolerance.dart';
import '../circle/circle_feed_test_support.dart';
import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// The Settings header: avatar, name, email, the friend count (accepted
/// friends only) and the two buttons that open "Sửa hồ sơ" and "Sửa vòng kết
/// nối" — the count opening the same page as the second button.
void main() {
  setUpGoldens();
  setUpAll(() => initOnboardingTest(fonts: false));

  FakeApiClient api() => FakeApiClient((request) async {
    switch (request.path) {
      case '/api/v1/groups/profile':
        return {
          'profile': {
            'userId': 'me',
            'handle': 'vmkhoiii',
            'displayName': 'vmkhoiii',
          },
        };
      case '/api/v1/groups/friends':
        return {
          'circle': [
            for (final (i, status)
                in ['accepted', 'accepted', 'pending'].indexed)
              {
                'friendshipId': 'f$i',
                'status': status,
                'profile': {'userId': 'u$i', 'handle': 'u$i'},
              },
          ],
        };
      case '/api/v1/groups/friends/blocked':
        return {'blocked': <dynamic>[]};
    }
    if (request.path.startsWith('/api/v1/chat-groups')) {
      return {'groups': <dynamic>[]};
    }
    return <String, dynamic>{};
  });

  Future<void> pump(WidgetTester tester) => pumpSettingsPage(
    tester,
    const SettingsScreen(),
    overrides: [
      apiClientProvider.overrideWithValue(api()),
      currentSessionProvider.overrideWithValue(testSession()),
      profileProvider.overrideWith(
        (ref) async => const ProfileRow(kFullProfile),
      ),
      onboardingResumeProvider.overrideWithValue(false),
      subscriptionSectionVisibleProvider.overrideWithValue(false),
    ],
  );

  testWidgets('counts accepted friends only', (tester) async {
    await pump(tester);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('bạn bè'), findsOneWidget);
  });

  testWidgets('the count opens Edit circle on Friends', (tester) async {
    await pump(tester);
    await tester.tap(find.text('2'));
    await tester.pumpAndSettle();
    final screen = tester.widget<CircleManageScreen>(
      find.byType(CircleManageScreen),
    );
    expect(screen.initialTab, CircleManageTab.friends);
  });

  testWidgets('"Sửa vòng kết nối" opens Edit circle', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Sửa vòng kết nối'));
    await tester.pumpAndSettle();
    expect(find.byType(CircleManageScreen), findsOneWidget);
  });

  testWidgets('"Sửa hồ sơ" opens the identity editor', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Sửa hồ sơ'));
    await tester.pumpAndSettle();
    expect(find.byType(IdentityScreen), findsOneWidget);
  });

  testWidgets('golden — the header, vi', (tester) async {
    await pump(tester);
    await expectLater(
      find.byType(SettingsProfileHeader),
      matchesGoldenFile('goldens/settings_profile_header_vi.png'),
    );
  }, skip: skipOffGoldenPlatform);
}
