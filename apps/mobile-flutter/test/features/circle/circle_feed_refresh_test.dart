import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/read_state/group_read_state.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/http/query_cache.dart';
import 'circle_feed_test_support.dart';

Map<String, dynamic> _page(List<String> ids, String? cursor) => {
  ...pageJson(ids.map(entryJson).toList(), cursor),
  'readThroughAt': '2026-11-10T03:00:00Z',
};

Map<String, dynamic> _group({String? messageAt}) => {
  'id': 'g',
  'kind': 'group',
  'title': 'Lunch',
  'updatedAt': '2026-11-10T01:00:00Z',
  'unread': true,
  'lastMessageAt': messageAt,
};

ProviderContainer _clockedContainer(
  FakeApiClient api,
  DateTime Function() now,
) {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(api),
      signedInUserIdProvider.overrideWithValue('me'),
      queryNowProvider.overrideWithValue(now),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  testWidgets(
    'a stale circle renders cached history while its head refreshes',
    (tester) async {
      final refreshed = Completer<Object?>();
      var headCalls = 0;
      final api = FakeApiClient((request) {
        if (request.path.contains('before=')) return _page(['tail'], 'oldest');
        if (++headCalls == 1) return _page(['head', 'anchor'], 'older');
        return refreshed.future;
      });
      var now = DateTime.utc(2026, 11, 10);
      final container = _clockedContainer(api, () => now);
      final feed = sharedMealFeedProvider('g');
      final first = container.listen(feed, (_, __) {});
      await tester.pump();
      final loadMore = container.read(feed.notifier).loadMore();
      await tester.pump();
      await loadMore;
      first.close();
      now = now.add(const Duration(minutes: 1, seconds: 1));
      await tester.pump(const Duration(minutes: 1, seconds: 1));

      container.listen(feed, (_, __) {});
      expect(
        container.read(feed).requireValue.entries.last.meal.shareId,
        'tail',
      );
      await tester.pump();
      expect(headCalls, 2);
      expect(container.read(feed).isLoading, isFalse);
      refreshed.complete(_page(['new', 'head', 'anchor'], 'server-cursor'));
      await tester.pump();
      final state = container.read(feed).requireValue;
      expect(state.entries.map((e) => e.meal.shareId), [
        'new',
        'head',
        'anchor',
        'tail',
      ]);
      expect(state.nextCursor, 'oldest');
      container.dispose();
      await tester.pump(const Duration(milliseconds: 1));
    },
  );

  test(
    'refresh is single-flight and preserves a heart changed during the request',
    () async {
      final gate = Completer<Object?>();
      var calls = 0;
      final api = FakeApiClient(
        (_) => ++calls == 1 ? _page(['head'], 'older') : gate.future,
      );
      final container = makeContainer(api);
      await mountFeed(container, 'g');
      final notifier = container.read(sharedMealFeedProvider('g').notifier);
      final first = notifier.refresh();
      final second = notifier.refresh();
      await notifier.loadMore();
      notifier.toggleReactionLocal('head');
      final updated = entryJson('head');
      (updated['meal'] as Map<String, dynamic>)['rawInput'] = 'Updated meal';
      gate.complete({
        ..._page([], null),
        'entries': [updated],
      });
      await Future.wait([first, second]);
      final entry =
          container
              .read(sharedMealFeedProvider('g'))
              .requireValue
              .entries
              .single;
      expect(calls, 2);
      expect(entry.reactions.mine, isTrue);
      expect(entry.reactions.count, 3);
      expect(entry.meal.rawInput, 'Updated meal');
    },
  );

  test(
    'a non-overlapping refresh uses the fresh cursor instead of skipping a gap',
    () async {
      var calls = 0;
      final container = makeContainer(
        FakeApiClient(
          (_) =>
              ++calls == 1
                  ? _page(['old'], 'old-cursor')
                  : _page(['new'], 'new-cursor'),
        ),
      );
      await mountFeed(container, 'g');
      await container.read(sharedMealFeedProvider('g').notifier).refresh();
      final state = container.read(sharedMealFeedProvider('g')).requireValue;
      expect(state.entries.single.meal.shareId, 'new');
      expect(state.nextCursor, 'new-cursor');
    },
  );

  test(
    'temporary refresh failures keep posts; revoked access clears them',
    () async {
      final api = FakeApiClient((_) => _page(['head'], null));
      final container = makeContainer(api);
      await mountFeed(container, 'g');
      final feed = sharedMealFeedProvider('g');
      final notifier = container.read(feed.notifier);
      api.handler = (_) => throw ApiError('UNAVAILABLE', 503, true, '');
      await expectLater(notifier.refresh(), throwsA(isA<ApiError>()));
      expect(
        container.read(feed).requireValue.entries.single.meal.shareId,
        'head',
      );
      api.handler = (_) => throw ApiError('NO_ACCESS', 403, false, '');
      await expectLater(notifier.refresh(), throwsA(isA<ApiError>()));
      expect(container.read(feed).valueOrNull?.entries, isEmpty);
      expect(container.read(feed).hasError, isTrue);
    },
  );

  test(
    'a server receipt clears the known unread meals without another list request',
    () async {
      var listCalls = 0;
      final container = makeContainer(
        FakeApiClient((request) {
          if (request.path.contains('/feed')) return _page(['head'], null);
          listCalls++;
          return {
            'groups': [_group()],
          };
        }),
      );
      holdProvider(container, chatGroupsProvider);
      holdProvider(container, groupReadReceiptProvider('g'));
      final groups = await container.read(chatGroupsProvider.future);
      await mountFeed(container, 'g');
      await container.pump();
      final receipt = container.read(groupReadReceiptProvider('g'));
      expect(receipt, isNotNull);
      expect(groupHasUnread(groups.single, receipt), isFalse);
      expect(listCalls, 1);
      // A new list snapshot may contain a post shared after the acknowledgement.
      expect(
        groupHasUnread(ChatGroupIdentity.fromJson(_group()), receipt),
        isTrue,
      );
      final message = ChatGroupIdentity.fromJson(
        _group(messageAt: '2026-11-10T04:00:00Z'),
      );
      expect(
        groupHasUnread(message, GroupReadReceipt(message, receipt!.through)),
        isTrue,
      );
    },
  );

  testWidgets('rapid circle loads reconcile a stale list only once', (
    tester,
  ) async {
    final gate = Completer<Object?>();
    var listCalls = 0;
    var now = DateTime.utc(2026, 11, 10);
    final container = _clockedContainer(
      FakeApiClient((request) {
        if (request.path.contains('/feed')) return _page(['head'], null);
        return ++listCalls == 1
            ? {
              'groups': [_group()],
            }
            : gate.future;
      }),
      () => now,
    );
    container.listen(chatGroupsProvider, (_, __) {});
    await tester.pump();
    now = now.add(const Duration(minutes: 1, seconds: 1));
    await tester.pump(const Duration(minutes: 1, seconds: 1));
    container.listen(sharedMealFeedProvider('g'), (_, __) {});
    await tester.pump(const Duration(milliseconds: 1));
    container.listen(sharedMealFeedProvider('other'), (_, __) {});
    await tester.pump(const Duration(milliseconds: 1));
    expect(listCalls, 2);
    gate.complete({
      'groups': [_group()],
    });
    await tester.pump();
    container.dispose();
    await tester.pump(const Duration(milliseconds: 1));
  });
}
