import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_mutations.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_time.dart';
import 'circle_feed_test_support.dart';

void main() {
  setUpAll(() async {
    // threadDayLabel formats older dates via intl DateFormat, which needs
    // locale data that easy_localization's delegates provide at runtime.
    await initializeDateFormatting();
  });

  group('page one and read markers', () {
    test('All exposes entries/cursor and invalidates friends marker', () async {
      var markerCalls = 0;
      final api = FakeApiClient((request) {
        if (request.path == '/api/v1/groups/friends/read-marker') {
          markerCalls++;
          return {'lastReadAt': '2026-07-18T01:00:00.000Z'};
        }
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('share-1')], 'cursor-1');
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      holdProvider(container, friendsReadMarkerProvider);
      await container.read(friendsReadMarkerProvider.future);

      final state = await mountFeed(container, null);
      await container.read(friendsReadMarkerProvider.future);

      expect(state.entries.single.meal.shareId, 'share-1');
      expect(state.nextCursor, 'cursor-1');
      expect(markerCalls, 2);
    });

    test('group page one invalidates the chat-groups list', () async {
      var groupListCalls = 0;
      final api = FakeApiClient((request) {
        if (request.path.startsWith('/api/v1/chat-groups?')) {
          groupListCalls++;
          return {
            'groups': [
              {
                'id': 'group-1',
                'kind': 'group',
                'title': 'Hội bún chả',
                'updatedAt': '2026-07-18T04:00:00.000Z',
                'unread': true,
              },
            ],
          };
        }
        if (request.path == '/api/v1/chat-groups/group-1/feed') {
          return pageJson([entryJson('share-1')], null);
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      holdProvider(container, chatGroupsProvider);
      await container.read(chatGroupsProvider.future);

      await mountFeed(container, 'group-1');
      await container.read(chatGroupsProvider.future);

      expect(groupListCalls, 2);
    });
  });

  test(
    'loadMore appends, dedupes, single-flights, and stops at null',
    () async {
      final olderPage = Completer<Object?>();
      var olderCalls = 0;
      final api = FakeApiClient((request) {
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('share-1')], 'cursor-1');
        }
        if (request.path.endsWith('?before=cursor-1')) {
          olderCalls++;
          return olderPage.future;
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      await mountFeed(container, null);
      final notifier = container.read(sharedMealFeedProvider(null).notifier);

      final first = notifier.loadMore();
      final second = notifier.loadMore();
      expect(
        container.read(sharedMealFeedProvider(null)).value!.isLoadingMore,
        isTrue,
      );
      expect(olderCalls, 1);
      olderPage.complete(
        pageJson([entryJson('share-1'), entryJson('share-2')], null),
      );
      await Future.wait([first, second]);

      final state = container.read(sharedMealFeedProvider(null)).value!;
      expect(state.entries.map((entry) => entry.meal.shareId), [
        'share-1',
        'share-2',
      ]);
      expect(state.nextCursor, isNull);
      expect(state.isLoadingMore, isFalse);
      await notifier.loadMore();
      expect(olderCalls, 1);
    },
  );

  group('feed mutations', () {
    test('group mutation invalidates after its caller scope is gone', () async {
      final create = Completer<Object?>();
      var groupListCalls = 0;
      final api = FakeApiClient((request) {
        if (request.path.startsWith('/api/v1/chat-groups?')) {
          groupListCalls++;
          return {'groups': <dynamic>[]};
        }
        if (request.path == '/api/v1/chat-groups') return create.future;
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      holdProvider(container, chatGroupsProvider);
      await container.read(chatGroupsProvider.future);

      final mutation = createChatGroup(
        container,
        name: 'Late response',
        memberUserIds: const ['u2'],
      );
      create.complete({
        'group': {'id': 'group-1'},
      });
      await mutation;
      await container.read(chatGroupsProvider.future);

      expect(groupListCalls, 2);
    });

    test(
      'reaction flips immediately then reconciles authoritative count',
      () async {
        final reaction = Completer<Object?>();
        final api = FakeApiClient((request) {
          if (request.path == '/api/v1/groups/friends/feed') {
            return pageJson([entryJson('share-1')], null);
          }
          if (request.path.startsWith('/api/v1/chat-groups?')) {
            return {'groups': <dynamic>[]};
          }
          if (request.path == '/api/v1/groups/shares/reaction') {
            return reaction.future;
          }
          return unexpectedRequest(request);
        });
        final container = makeContainer(api);
        await mountFeed(container, null);

        final mutation = toggleShareReaction(
          ContainerWidgetRef(container),
          'share-1',
        );
        var entry =
            container.read(sharedMealFeedProvider(null)).value!.entries.single;
        expect((entry.reactions.mine, entry.reactions.count), (true, 3));
        reaction.complete({'reacted': true, 'count': 7});
        await mutation;

        entry =
            container.read(sharedMealFeedProvider(null)).value!.entries.single;
        expect((entry.reactions.mine, entry.reactions.count), (true, 7));
      },
    );

    test('reaction error restores the exact snapshot', () async {
      final reaction = Completer<Object?>();
      final api = FakeApiClient((request) {
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('share-1', mine: true, count: 5)], null);
        }
        if (request.path.startsWith('/api/v1/chat-groups?')) {
          return {'groups': <dynamic>[]};
        }
        if (request.path == '/api/v1/groups/shares/reaction') {
          return reaction.future;
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      await mountFeed(container, null);

      final mutation = toggleShareReaction(
        ContainerWidgetRef(container),
        'share-1',
      );
      final pending =
          container.read(sharedMealFeedProvider(null)).value!.entries.single;
      expect((pending.reactions.mine, pending.reactions.count), (false, 4));
      final expectation = expectLater(mutation, throwsA(isA<ApiError>()));
      reaction.completeError(ApiError('INTERNAL', 500, true, 'failed'));
      await expectation;

      final restored =
          container.read(sharedMealFeedProvider(null)).value!.entries.single;
      expect((restored.reactions.mine, restored.reactions.count), (true, 5));
    });

    test('reaction result reaches a feed mounted during the request', () async {
      final reaction = Completer<Object?>();
      final api = FakeApiClient((request) {
        if (request.path == '/api/v1/groups/friends/feed' ||
            request.path == '/api/v1/chat-groups/group-1/feed') {
          return pageJson([entryJson('share-1')], null);
        }
        if (request.path == '/api/v1/groups/shares/reaction') {
          return reaction.future;
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      await mountFeed(container, null);

      final mutation = toggleShareReaction(
        ContainerWidgetRef(container),
        'share-1',
      );
      container.read(circleSelectedViewProvider.notifier).state = 'group-1';
      await mountFeed(container, 'group-1');
      reaction.complete({'reacted': true, 'count': 9});
      await mutation;

      final groupEntry =
          container
              .read(sharedMealFeedProvider('group-1'))
              .value!
              .entries
              .single;
      expect(
        (groupEntry.reactions.mine, groupEntry.reactions.count),
        (true, 9),
      );
    });

    test(
      'reply waits for echo, sends id, dedupes, caps 12, bumps total',
      () async {
        final reply = Completer<Object?>();
        final initialReplies = List.generate(
          12,
          (index) => replyJson('r$index'),
        );
        final api = FakeApiClient((request) {
          if (request.path == '/api/v1/groups/friends/feed') {
            return pageJson([
              entryJson('share-1', replies: initialReplies, repliesTotal: 20),
            ], null);
          }
          if (request.path.startsWith('/api/v1/chat-groups?')) {
            return {'groups': <dynamic>[]};
          }
          if (request.path == '/api/v1/groups/shares/reply') {
            return reply.future;
          }
          return unexpectedRequest(request);
        });
        final container = makeContainer(api);
        await mountFeed(container, null);
        final ref = ContainerWidgetRef(container);

        final mutation = createShareReply(
          ref,
          shareId: 'share-1',
          body: 'Ngon quá!',
        );
        var entry =
            container.read(sharedMealFeedProvider(null)).value!.entries.single;
        expect(entry.repliesTotal, 20);
        final request = api.requests.last;
        final body = request.body! as Map<String, dynamic>;
        expect(body['replyId'], matches(RegExp(r'^[0-9a-f-]{36}$')));
        reply.complete(replyJson('server-reply'));
        await mutation;

        entry =
            container.read(sharedMealFeedProvider(null)).value!.entries.single;
        expect(entry.replies.length, 12);
        expect(entry.replies.first.id, 'r1');
        expect(entry.replies.last.id, 'server-reply');
        expect(entry.repliesTotal, 21);

        api.handler =
            (request) =>
                request.path == '/api/v1/groups/shares/reply'
                    ? replyJson('server-reply')
                    : request.path.startsWith('/api/v1/chat-groups?')
                    ? {'groups': <dynamic>[]}
                    : unexpectedRequest(request);
        await createShareReply(ref, shareId: 'share-1', body: 'Lần nữa');
        entry =
            container.read(sharedMealFeedProvider(null)).value!.entries.single;
        expect((entry.replies.length, entry.repliesTotal), (12, 21));
      },
    );
  });

  group('feed time', () {
    final now = DateTime(2026, 7, 18, 12);

    test('formatElapsed follows minute/hour/day boundaries', () {
      expect(
        formatElapsed(
          now.subtract(const Duration(seconds: 10)),
          now: now,
          locale: 'en',
        ),
        '1m ago',
      );
      expect(
        formatElapsed(
          now.subtract(const Duration(minutes: 59)),
          now: now,
          locale: 'en',
        ),
        '59m ago',
      );
      expect(
        formatElapsed(
          now.subtract(const Duration(minutes: 60)),
          now: now,
          locale: 'en',
        ),
        '1h ago',
      );
      expect(
        formatElapsed(
          now.subtract(const Duration(hours: 23)),
          now: now,
          locale: 'en',
        ),
        '23h ago',
      );
      expect(
        formatElapsed(
          now.subtract(const Duration(hours: 24)),
          now: now,
          locale: 'en',
        ),
        '1d ago',
      );
      expect(
        formatElapsed(
          now.subtract(const Duration(hours: 1)),
          now: now,
          locale: 'vi',
        ),
        '1 giờ trước',
      );
    });

    test('thread day helpers return localizable and older date labels', () {
      expect(threadDayKey(now), '2026-07-18');
      expect(
        threadDayLabel(DateTime(2026, 7, 18), now: now, locale: 'en').kind,
        ThreadDayLabelKind.today,
      );
      expect(
        threadDayLabel(DateTime(2026, 7, 17), now: now, locale: 'en').kind,
        ThreadDayLabelKind.yesterday,
      );
      final older = threadDayLabel(
        DateTime(2026, 7, 12),
        now: now,
        locale: 'en',
      );
      final olderYear = threadDayLabel(
        DateTime(2025, 7, 12),
        now: now,
        locale: 'en',
      );
      expect(
        (older.kind, older.dateLabel),
        (ThreadDayLabelKind.date, 'July 12'),
      );
      expect(olderYear.dateLabel, 'July 12, 2025');
    });
  });
}
