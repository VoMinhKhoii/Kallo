import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/local_blocks.dart';
import 'package:kallo_mobile/features/circle/data/moderation_mutations.dart';
import 'package:kallo_mobile/features/circle/data/thread_providers.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../circle_feed_test_support.dart';

/// A block hides the person's content the moment it lands, not when the
/// refetch it starts comes back: every cache keeps its old value through a
/// refresh, so until then the post, its composer and its hearts stayed live on
/// content the server now refuses.
void main() {
  test('a block empties the thread before the refetch lands; only a value '
      'fetched after it can show them again', () async {
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
    expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());
    // Read against the refetch, which is in flight and holding the old page
    // — the window this guards.
    await pumpEventQueue();
    expect(feedFetches, 2);
    expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());

    // An unblock proves nothing about the cached page (it restores no
    // friendship), so the page fetched before the block stays hidden.
    await unblockCircleUser(ref, 'friend-s1');
    expect(container.read(threadEntryProvider(key)), isA<ThreadMissing>());

    // The refetch — asked for after the block — is the server's own answer,
    // and it shows them.
    refetch.complete();
    await pumpEventQueue();
    expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());
  });

  test('a refused block hides nothing', () async {
    final api = FakeApiClient((request) async {
      if (request.method == 'POST') throw Exception('offline');
      return <String, dynamic>{};
    });
    final container = makeContainer(api);
    final entry = CircleFeedEntry.fromJson(entryJson('s1'));

    await expectLater(
      blockCircleUser(ContainerWidgetRef(container), 'friend-s1'),
      throwsException,
    );
    expect(
      container.read(localBlocksProvider).hides('friend-s1', entry),
      isFalse,
    );
  });

  test('a heart on a post fetched after the block keeps it visible', () async {
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      return <String, dynamic>{};
    });
    final container = makeContainer(api);
    // Blocked, then unblocked elsewhere: this feed is fetched after the block
    // and the server shows them.
    container.read(localBlocksProvider.notifier).add('friend-s1');
    await mountFeed(container, null);

    final feed = sharedMealFeedProvider(null);
    container.read(feed.notifier).toggleReactionLocal('s1');
    final hearted = container.read(feed).requireValue.entries.single;

    expect(hearted.reactions.mine, isTrue);
    expect(
      container.read(localBlocksProvider).hides('friend-s1', hearted),
      isFalse,
    );
  });

  test(
    'a group list fetched after the block is trusted for its unread flags',
    () async {
      final api = FakeApiClient((request) async {
        if (request.path.startsWith('/api/v1/chat-groups?')) {
          return {
            'groups': [
              {
                'id': 'g1',
                'kind': 'group',
                'title': 'Weekend hikers',
                'updatedAt': '2026-07-18T00:00:00Z',
                'unread': true,
              },
            ],
          };
        }
        return <String, dynamic>{};
      });
      final container = makeContainer(api);
      container.read(localBlocksProvider.notifier).add('friend-s1');

      holdProvider(container, chatGroupsProvider);
      final groups = await container.read(chatGroupsProvider.future);

      expect(
        container.read(localBlocksProvider).predatesAnyBlock(groups.single),
        isFalse,
      );
    },
  );

  test(
    'a friends list fetched after the block is the server\'s answer',
    () async {
      // Unblocked and re-friended elsewhere: the fresh list has them again.
      final api = FakeApiClient((request) async {
        if (request.path == '/api/v1/groups/friends') {
          return {
            'circle': [
              {
                'friendshipId': 'f1',
                'status': 'accepted',
                'profile': {'userId': 'friend-s1', 'handle': 'h'},
              },
            ],
          };
        }
        return <String, dynamic>{};
      });
      final container = makeContainer(api);
      container.read(localBlocksProvider.notifier).add('friend-s1');

      holdProvider(container, circleFriendsProvider);
      final friends = await container.read(circleFriendsProvider.future);

      expect(
        container.read(localBlocksProvider).hides('friend-s1', friends.single),
        isFalse,
      );
    },
  );

  group('a stale entry drops a blocked replier from its replies and count', () {
    late ProviderContainer container;
    setUp(() {
      container = ProviderContainer();
      addTearDown(container.dispose);
    });
    CircleFeedEntry stale({required int total}) {
      final entry = CircleFeedEntry.fromJson(
        entryJson(
          's1',
          replies: [replyJson('r1'), replyJson('r2')],
          repliesTotal: total,
        ),
      );
      stampEntries([entry], 0);
      return entry;
    }

    LocalBlocks blockR1() {
      container.read(localBlocksProvider.notifier).add('author-r1');
      return container.read(localBlocksProvider);
    }

    test('every reply in the preview: the total is exact', () {
      final entry = stale(total: 2);
      final shown = withoutBlockedReplies(blockR1(), entry);

      expect([for (final r in shown.replies) r.id], ['r2']);
      expect(shown.repliesTotal, 1);
      expect(
        container.read(localBlocksProvider).hides('friend-s1', shown),
        isFalse,
      );
    });

    test('a cut-off preview: only what is on screen is counted', () {
      // The server sends the newest dozen and a total for all: older replies
      // by the blocked person may be in the 5, so it cannot be vouched for.
      final shown = withoutBlockedReplies(blockR1(), stale(total: 5));

      expect(shown.repliesTotal, 1);
    });

    test('an entry fetched after every block is left as it came', () {
      final blocks = blockR1();
      final fresh = CircleFeedEntry.fromJson(
        entryJson('s1', replies: [replyJson('r2')], repliesTotal: 30),
      );
      stampEntries([
        fresh,
      ], container.read(localBlocksProvider.notifier).generation);

      expect(withoutBlockedReplies(blocks, fresh), same(fresh));
      final untouched = stale(total: 2);
      // And with no blocks at all, nothing is ever copied.
      expect(
        withoutBlockedReplies(const LocalBlocks(), untouched),
        same(untouched),
      );
    });
  });

  group('each cached value is judged by when it was fetched', () {
    late ProviderContainer container;
    late LocallyBlockedUsers blocks;
    setUp(() {
      container = ProviderContainer();
      addTearDown(container.dispose);
      blocks = container.read(localBlocksProvider.notifier);
    });
    bool hides(Object content) =>
        container.read(localBlocksProvider).hides('friend-s1', content);

    test('fetched before the block: hidden, however long it lingers', () {
      final stale = Object();
      stampFetched([stale], blocks.generation);
      blocks.add('friend-s1');

      expect(hides(stale), isTrue);
    });

    test('in flight when the block landed: hidden', () {
      final inFlight = Object();
      final since = blocks.generation; // the request starts…
      blocks.add('friend-s1'); // …the block lands…
      stampFetched([inFlight], since); // …and its answer arrives.

      expect(hides(inFlight), isTrue);
    });

    test('fetched after the block: shown as the server sent it, in that '
        'value only', () {
      // A group feed refetched after an unblock elsewhere shows them; the
      // friends feed whose refetch failed keeps its old value, hidden.
      final staleFriendsFeed = Object();
      stampFetched([staleFriendsFeed], blocks.generation);
      blocks.add('friend-s1');
      final freshGroupFeed = Object();
      stampFetched([freshGroupFeed], blocks.generation);

      expect(hides(freshGroupFeed), isFalse);
      expect(hides(staleFriendsFeed), isTrue);
    });

    test('a patched copy keeps its stamp', () {
      blocks.add('friend-s1');
      final fresh = Object();
      stampFetched([fresh], blocks.generation);
      final hearted = Object();
      carryStamp(fresh, hearted);

      expect(hides(hearted), isFalse);
    });

    test('and never because time passed', () async {
      final stale = Object();
      stampFetched([stale], blocks.generation);
      blocks.add('friend-s1');

      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(hides(stale), isTrue);
    });
  });
}
