import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/local_blocks.dart';
import 'package:kallo_mobile/features/circle/data/moderation_mutations.dart';
import 'package:kallo_mobile/features/circle/data/thread_providers.dart';

import '../circle_feed_test_support.dart';

/// A block hides the person's content the moment it lands, not when the
/// refetch it starts comes back: every cache keeps its old value through a
/// refresh, so until then the post, its composer and its hearts stayed live on
/// content the server now refuses.
void main() {
  test('a block empties the thread before the refetch lands, and only a fetch '
      'that shows them again lifts it', () async {
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

    // An unblock alone lifts nothing: it restores no friendship, so it is
    // no proof the cached post is theirs to see again.
    await unblockCircleUser(ref, 'friend-s1');
    expect(container.read(locallyBlockedUserIdsProvider), {'friend-s1'});
    expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());

    // The refetch — asked for after the block — comes back showing them.
    refetch.complete();
    await pumpEventQueue();
    expect(container.read(locallyBlockedUserIdsProvider), isEmpty);
    expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());
  });

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

  group('an entry leaves only on the server\'s word', () {
    test('a fetch asked for after the block that still shows them', () async {
      // Unblocked on another device: the server serves their post again.
      final api = FakeApiClient((request) async {
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('s1')], null);
        }
        return <String, dynamic>{};
      });
      final container = makeContainer(api);
      final blocks = container.read(locallyBlockedUserIdsProvider.notifier);
      blocks.add('friend-s1');

      await mountFeed(container, null);

      expect(container.read(locallyBlockedUserIdsProvider), isEmpty);
    });

    test('not a fetch that was already in flight when the block landed', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final blocks = container.read(locallyBlockedUserIdsProvider.notifier);
      final since = blocks.generation; // the fetch starts…
      blocks.add('friend-s1'); // …the block lands…

      // …and the fetch's pre-block answer still shows them.
      blocks.reconcileShown(['friend-s1'], since: since);

      expect(container.read(locallyBlockedUserIdsProvider), {'friend-s1'});
    });

    test(
      'an invites fetch asked for after the block with an offer from them',
      () async {
        final api = FakeApiClient((request) async {
          if (request.path == '/api/v1/groups/invites') {
            return {
              'invites': [
                {
                  'id': 'i1',
                  'mode': 'copy',
                  'portionFactor': 1,
                  'createdAt': '2026-09-28T10:00:00.000Z',
                  'from': {
                    'userId': 'friend-s1',
                    'handle': 'h',
                    'displayName': 'H',
                  },
                  'meal': {'rawInput': 'Trà sữa', 'caloriesKcal': 100},
                },
              ],
            };
          }
          return <String, dynamic>{};
        });
        final container = makeContainer(api);
        container.read(locallyBlockedUserIdsProvider.notifier).add('friend-s1');

        holdProvider(container, mealShareInvitesProvider);
        await container.read(mealShareInvitesProvider.future);

        expect(container.read(locallyBlockedUserIdsProvider), isEmpty);
      },
    );

    test('and never because time passed', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(locallyBlockedUserIdsProvider.notifier).add('friend-s1');

      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(container.read(locallyBlockedUserIdsProvider), {'friend-s1'});
    });
  });
}
