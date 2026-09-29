import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';

import '../circle_feed_test_support.dart';

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

  test('removing a friend refreshes the unread marker', () async {
    // Its latestSharedAt may be the removed friend's share, which would keep
    // the All dot lit for a post the viewer can no longer see.
    var markerFetches = 0;
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/read-marker') {
        markerFetches++;
        return {
          'lastReadAt': '2026-07-18T01:00:00.000Z',
          'latestSharedAt': '2026-07-18T02:00:00.000Z',
        };
      }
      return <String, dynamic>{};
    });
    final container = makeContainer(api);
    holdProvider(container, friendsReadMarkerProvider);
    await container.read(friendsReadMarkerProvider.future);

    await removeCircleFriend(ContainerWidgetRef(container), 'friend-s1');
    await container.read(friendsReadMarkerProvider.future);

    expect(markerFetches, 2);
  });
}
