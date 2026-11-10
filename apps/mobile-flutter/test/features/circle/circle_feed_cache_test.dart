import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';

FakeApiClient _feedApi(RequestHandler handler) => FakeApiClient((request) {
  if (request.path.contains('/feed')) return handler(request);
  if (request.path.endsWith('/read-marker')) {
    return {'lastReadAt': '2026-07-18T01:00:00.000Z'};
  }
  return {'groups': []};
});

int _feedCalls(FakeApiClient api) =>
    api.requests.where((request) => request.path.contains('/feed')).length;

void main() {
  test(
    'returning before the first feed response reuses the in-flight request',
    () async {
      final gate = Completer<Object?>();
      final api = _feedApi((_) => gate.future);
      final container = makeContainer(api);
      final feed = sharedMealFeedProvider('group-1');
      final first = container.listen(feed, (_, __) {});
      first.close();
      await container.pump();
      final returned = container.listen(feed, (_, __) {});
      expect(_feedCalls(api), 1);
      gate.complete(pageJson([entryJson('post')], null));
      expect(
        (await container.read(feed.future)).entries.single.meal.shareId,
        'post',
      );
      returned.close();
    },
  );

  test('All → group → All retains older pages and pagination cursor', () async {
    final api = _feedApi((request) {
      if (request.path.endsWith('?before=older')) {
        return pageJson([entryJson('old')], 'oldest');
      }
      return pageJson([entryJson(request.path)], 'older');
    });
    final container = makeContainer(api);
    final all = sharedMealFeedProvider(null);
    final first = container.listen(all, (_, __) {});
    await container.read(all.future);
    await container.read(all.notifier).loadMore();
    first.close();
    await container.pump();

    final group = sharedMealFeedProvider('group-1');
    final other = container.listen(group, (_, __) {});
    await container.read(group.future);
    other.close();
    await container.pump();

    final returned = container.listen(all, (_, __) {});
    final state = await container.read(all.future);
    expect(state.entries.last.meal.shareId, 'old');
    expect(state.nextCursor, 'oldest');
    expect(_feedCalls(api), 3);
    returned.close();

    final groupReturn = container.listen(group, (_, __) {});
    await container.read(group.future);
    expect(_feedCalls(api), 3);
    groupReturn.close();
  });

  testWidgets('unused feeds expire after five minutes', (tester) async {
    final api = _feedApi((_) => pageJson([entryJson('post')], null));
    final container = makeContainer(api);
    final feed = sharedMealFeedProvider('group-1');
    final subscription = container.listen(feed, (_, __) {});
    await tester.pump();
    expect(container.read(feed).hasValue, isTrue);
    subscription.close();
    await tester.pump(const Duration(minutes: 4));
    expect(container.exists(feed), isTrue);
    await tester.pump(const Duration(minutes: 1, seconds: 1));
    await tester.pump();
    expect(container.exists(feed), isFalse);

    container.listen(feed, (_, __) {});
    await tester.pump();
    expect(_feedCalls(api), 2);
    container.dispose();
    // Riverpod's zero-duration disposal task needs clock advancement too.
    await tester.pump(const Duration(milliseconds: 1));
  });

  test('explicit refresh and leaving a group discard retained posts', () async {
    var version = 0;
    final api = _feedApi((_) => pageJson([entryJson('${++version}')], null));
    final container = makeContainer(api);
    final feed = sharedMealFeedProvider('group-1');
    final subscription = container.listen(feed, (_, __) {});
    await container.read(feed.future);
    container.invalidate(feed);
    expect(
      (await container.read(feed.future)).entries.single.meal.shareId,
      '2',
    );
    subscription.close();
    await container.pump();
    await leaveChatGroup(container, 'group-1');
    await container.pump();
    expect(container.exists(feed), isFalse);
  });

  test('failed first loads are not retained', () async {
    final api = _feedApi((_) => throw ApiError('NO_ACCESS', 403, false, ''));
    final container = makeContainer(api);
    final feed = sharedMealFeedProvider('group-1');
    final subscription = container.listen(feed, (_, __) {});
    await expectLater(container.read(feed.future), throwsA(isA<ApiError>()));
    subscription.close();
    await container.pump();
    expect(container.exists(feed), isFalse);
  });

  test(
    'account changes clear feeds; signed-out feeds make no request',
    () async {
      final account = StateProvider<String?>((ref) => 'a');
      var calls = 0;
      final api = _feedApi(
        (_) => pageJson([entryJson('post-${++calls}')], null),
      );
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          signedInUserIdProvider.overrideWith((ref) => ref.watch(account)),
        ],
      );
      addTearDown(container.dispose);
      final feed = sharedMealFeedProvider('group-1');
      final subscription = container.listen(feed, (_, __) {});
      await container.read(feed.future);
      subscription.close();
      await container.pump();

      container.read(account.notifier).state = null;
      await container.pump();
      await expectLater(container.read(feed.future), throwsA(isA<ApiError>()));
      expect(calls, 1);
      container.read(account.notifier).state = 'b';
      final returned = container.listen(feed, (_, __) {});
      expect(
        (await container.read(feed.future)).entries.single.meal.shareId,
        'post-2',
      );
      returned.close();
    },
  );
  test('an older-page request cannot restore posts after refresh', () async {
    final older = Completer<Object?>();
    var firstPages = 0;
    final api = _feedApi((request) {
      if (request.path.contains('before=')) return older.future;
      return pageJson([entryJson('page-${++firstPages}')], 'older');
    });
    final container = makeContainer(api);
    final feed = sharedMealFeedProvider('group-1');
    holdProvider(container, feed);
    await container.read(feed.future);
    final loading = container.read(feed.notifier).loadMore();
    container.invalidate(feed);
    await container.read(feed.future);
    older.complete(pageJson([entryJson('stale')], null));
    await loading;
    expect(container.read(feed).value!.entries.single.meal.shareId, 'page-2');
  });
}
