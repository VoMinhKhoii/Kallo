import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_manage_screen.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../golden_tolerance.dart';
import '../../onboarding/onboarding_test_support.dart';
import '../../settings/settings_test_support.dart';
import '../circle_feed_test_support.dart';

/// Pixel record of "Edit circle": the underline tabs, the quiet `⋯` rows,
/// the outline "Xem nhóm" squircle and the "Đã chặn (n)" foot row — in
/// Vietnamese, on the 390×844 phone. No empty-state golden: the capybara
/// sleeps from 22:00 to 05:00, so its picture depends on the wall clock.
void main() {
  setUpGoldens();
  setUpAll(() => initOnboardingTest(fonts: false));

  Map<String, dynamic> member(String id, String name) => {
    'friendshipId': 'f-$id',
    'status': 'accepted',
    'profile': {'userId': id, 'handle': id, 'displayName': name},
  };

  FakeApiClient api({
    List<Map<String, dynamic>> friends = const [],
    List<Map<String, dynamic>> groups = const [],
    int blocked = 0,
  }) => FakeApiClient((request) async {
    final path = request.path;
    if (path == '/api/v1/groups/friends') return {'circle': friends};
    if (path == '/api/v1/groups/friends/blocked') {
      return {
        'blocked': [
          for (var i = 0; i < blocked; i++)
            {
              'profile': {'userId': 'b$i', 'handle': 'b$i'},
              'blockedAt': '2026-09-20T00:00:00.000Z',
            },
        ],
      };
    }
    if (path.startsWith('/api/v1/chat-groups')) return {'groups': groups};
    if (path == '/api/v1/groups/profile') {
      return {
        'profile': {'userId': 'me', 'handle': 'me', 'displayName': 'vmkhoiii'},
      };
    }
    return <String, dynamic>{};
  });

  Future<void> shoot(
    WidgetTester tester,
    FakeApiClient backend,
    String name, {
    CircleManageTab tab = CircleManageTab.friends,
  }) async {
    await pumpSettingsPage(
      tester,
      Scaffold(
        body: CircleManageScreen(parentTitle: 'Cài đặt', initialTab: tab),
      ),
      overrides: [apiClientProvider.overrideWithValue(backend)],
    );
    await expectLater(
      find.byType(CircleManageScreen),
      matchesGoldenFile('goldens/$name.png'),
    );
  }

  testWidgets('friends, with someone blocked — vi', (tester) async {
    await shoot(
      tester,
      api(
        friends: [
          member('u1', 'Linh Trần'),
          member('u2', 'Minh Anh'),
          member('u3', 'Bảo Ngọc'),
        ],
        blocked: 2,
      ),
      'circle_manage_friends_vi',
    );
  }, skip: skipOffGoldenPlatform);

  testWidgets('groups — vi', (tester) async {
    await shoot(
      tester,
      api(
        groups: [
          {
            'id': 'g1',
            'kind': 'group',
            'title': 'Nhà mình',
            'updatedAt': '2026-09-28T00:00:00.000Z',
          },
          {
            'id': 'g2',
            'kind': 'group',
            'title': 'Team ăn trưa',
            'updatedAt': '2026-09-28T00:00:00.000Z',
          },
        ],
      ),
      'circle_manage_groups_vi',
      tab: CircleManageTab.circle,
    );
  }, skip: skipOffGoldenPlatform);
}
