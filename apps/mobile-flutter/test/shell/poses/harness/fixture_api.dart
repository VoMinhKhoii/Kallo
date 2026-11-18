import '../../../features/circle/circle_feed_test_support.dart';
import 'fixtures.dart';
import 'nutrition_fixture.dart';

FakeApiClient fixtureApi(PoseFixtures f) => FakeApiClient((request) {
  final path = Uri.parse(request.path).path;
  return switch (path) {
    '/api/v1/dashboard' => f.dashboard,
    '/api/v1/dashboard/heatmap' => f.heatmap,
    '/api/v1/logging/day' => f.day,
    '/api/v1/onboarding/profile' => f.profile,
    '/api/v1/nutrition/overview' => nutritionFixture(f),
    '/api/v1/groups/profile' => {'profile': f.circleProfile},
    '/api/v1/groups/feed' => {'feed': f.posts},
    '/api/v1/groups/shares/thread-detail' => {'entry': f.thread},
    '/api/v1/groups/friends/feed' => {'entries': f.posts, 'nextCursor': null},
    '/api/v1/groups/friends/read-marker' => {
      'lastReadAt': '${f.date(0)}T00:00:00Z',
    },
    '/api/v1/groups/friends' => {
      'circle': [
        for (var i = 0; i < 2; i++)
          {
            'friendshipId': 'edge-$i',
            'status': 'accepted',
            'profile': f.posts[i]['friend'],
          },
      ],
    },
    '/api/v1/groups/invites' => {'invites': <dynamic>[]},
    '/api/v1/chat-groups' => {'groups': <dynamic>[]},
    '/api/v1/meals/dates' => [for (var i = 0; i < 30; i++) f.date(i)],
    '/api/v1/account/entitlements' => {
      'tier': 'premium',
      'complimentary': true,
      'purchasesEnabled': false,
      'enforcementEnabled': false,
    },
    _ => unexpectedRequest(request),
  };
});
