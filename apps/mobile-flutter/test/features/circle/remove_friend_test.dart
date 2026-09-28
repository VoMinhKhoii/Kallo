import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';

import 'circle_feed_test_support.dart';

/// Removing a friend has to refresh the posts the Circle tab is showing, not
/// only the friends list: the tab stays mounted in its shell branch, so a
/// removal made from Settings otherwise left the removed person's meals on
/// the page until a manual refresh.
void main() {
  test('removing a friend refetches the mounted post feed', () async {
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      return <String, dynamic>{};
    });
    final container = makeContainer(api);
    await mountFeed(container, null);

    int feedFetches() =>
        api.requests
            .where(
              (r) =>
                  r.method == 'GET' && r.path == '/api/v1/groups/friends/feed',
            )
            .length;
    expect(feedFetches(), 1);

    await removeCircleFriend(ContainerWidgetRef(container), 'friend-s1');
    await mountFeed(container, null);

    expect(api.requests.any((r) => r.method == 'DELETE'), isTrue);
    expect(feedFetches(), 2);
  });
}
