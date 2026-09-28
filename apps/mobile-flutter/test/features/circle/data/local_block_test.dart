import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/moderation_mutations.dart';
import 'package:kallo_mobile/features/circle/data/thread_providers.dart';

import '../circle_feed_test_support.dart';

/// A block hides the person's content the moment it lands, not when the
/// refetch it starts comes back: every cache keeps its old value through a
/// refresh, so until then the post, its composer and its hearts stayed live on
/// content the server now refuses.
void main() {
  test(
    'a block empties the thread before the refetch lands; unblock lifts it',
    () async {
      final refetch = Completer<void>();
      var feedFetches = 0;
      final api = FakeApiClient((request) async {
        if (request.path == '/api/v1/groups/friends/feed') {
          // Every fetch after the first is the refresh a block or unblock
          // starts, and it hangs.
          if (feedFetches++ > 0) await refetch.future;
          return pageJson([entryJson('s1')], null);
        }
        return <String, dynamic>{};
      });
      final container = makeContainer(api);
      await mountFeed(container, null);
      const key = (scope: null, shareId: 's1');
      holdProvider(container, threadEntryProvider(key));
      expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());

      final ref = ContainerWidgetRef(container);
      await blockCircleUser(ref, 'friend-s1');

      expect(container.read(locallyBlockedUserIdsProvider), {'friend-s1'});
      expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());
      // Read against the refetch, which is in flight and holding the old
      // page — the window this guards.
      await pumpEventQueue();
      expect(feedFetches, 2);
      expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());

      await unblockCircleUser(ref, 'friend-s1');
      expect(container.read(locallyBlockedUserIdsProvider), isEmpty);

      refetch.complete();
    },
  );

  test('a refused block hides nothing', () async {
    final api = FakeApiClient((request) async {
      if (request.method == 'POST') throw Exception('offline');
      return <String, dynamic>{};
    });
    final container = makeContainer(api);

    await expectLater(
      blockCircleUser(ContainerWidgetRef(container), 'friend-s1'),
      throwsException,
    );
    expect(container.read(locallyBlockedUserIdsProvider), isEmpty);
  });

  // testWidgets for its fake clock: the entry lives on a Timer.
  testWidgets('an entry expires once any refetch has had time to land', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final ids = locallyBlockedUserIdsProvider;
    container.read(ids.notifier).add('friend-s1');

    await tester.pump(const Duration(seconds: 59));
    expect(container.read(ids), {'friend-s1'});
    // After this the server's answer is the only one — including an unblock
    // made on another device.
    await tester.pump(const Duration(seconds: 2));
    expect(container.read(ids), isEmpty);
  });
}
