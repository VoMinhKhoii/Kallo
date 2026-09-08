import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/share_entry_provider.dart';
import 'package:kallo_mobile/features/circle/data/thread_providers.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_error.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// The thread page's SECOND source: `GET /api/v1/groups/shares/<id>`.
///
/// The feed cache is the primary one — it is what the optimistic mutations
/// patch — but it only ever holds the pages the app has loaded, of the feed
/// the app is looking at. A share notification opens `/circle/<shareId>` with
/// no scope, so a post on page 2, or a post shared only into a chat group by
/// someone the viewer is not friends with, was absent from that cache and the
/// page said "This post isn't here any more" about a post that exists.
///
/// What is pinned here: the fallback fires only when the feed has SETTLED
/// without the post, a 404 still reads as gone, and a post opened this way is
/// a full thread — its replies post and land.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  /// A single-share payload whose meal text is its OWN, so a test can tell the
  /// post that came from the fallback apart from the ones in the feed page.
  Map<String, dynamic> fallbackEntry(
    String shareId, {
    String rawInput = 'Phở bò tái',
    List<Map<String, dynamic>> replies = const [],
    int? repliesTotal,
  }) {
    final json = entryJson(
      shareId,
      replies: replies,
      repliesTotal: repliesTotal,
    );
    json['meal'] = {
      ...json['meal'] as Map<String, dynamic>,
      'rawInput': rawInput,
    };
    return json;
  }

  Iterable<Request> shareFetches(FakeApiClient api, String shareId) => api
      .requests
      .where((r) => r.method == 'GET' && r.path == sharePath(shareId));

  testWidgets('a post the loaded feed never carried is fetched by id', (
    tester,
  ) async {
    // Page 1 of the friends feed, and the notification points at s9 — which
    // is on page 2, or in a group this viewer's friends feed cannot see.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], 'cursor-1');
      }
      if (request.path == sharePath('s9')) {
        return shareJson(fallbackEntry('s9'));
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's9'),
      api: api,
    );

    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(find.text("This post isn't here any more"), findsNothing);
    expect(shareFetches(api, 's9'), hasLength(1));
  });

  testWidgets('a share that is gone or not ours to see stays the gone state', (
    tester,
  ) async {
    // 404 is BOTH "deleted" and "not visible to you" — the server keeps them
    // indistinguishable on purpose, and the page owes one answer for both.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == sharePath('s9')) {
        throw ApiError('NOT_FOUND', 404, false, 'không tìm thấy');
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's9'),
      api: api,
    );

    expect(find.text("This post isn't here any more"), findsOneWidget);
    expect(find.byType(CircleErrorCard), findsNothing);
  });

  testWidgets('a fetch that fails offers a retry, not a headstone', (
    tester,
  ) async {
    // A transport failure is not a deleted post: telling someone their friend's
    // meal is gone because the train went into a tunnel is a lie the user
    // cannot undo — they close the notification and never come back.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == sharePath('s9')) {
        throw Exception('connection closed');
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's9'),
      api: api,
    );

    expect(find.byType(CircleErrorCard), findsOneWidget);
    expect(find.text("This post isn't here any more"), findsNothing);
  });

  testWidgets('a post the feed already has is never fetched again', (
    tester,
  ) async {
    // The feed cache stays the PRIMARY source: it is what `appendReply` and
    // `applyReaction` patch on the same frame as the card behind this page.
    // A page that fetched anyway would race those writes and could only lose.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([
          entryJson('s1', replies: [replyJson('r1')]),
        ], null);
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );

    expect(find.text('Bún chả Hà Nội'), findsOneWidget);
    expect(shareFetches(api, 's1'), isEmpty);
  });

  testWidgets('a reply written on a fetched post lands on it', (tester) async {
    // The mutation cannot splice into a feed that does not hold this post, so
    // the fallback is refetched on a successful reply. Without that, the reply
    // posts and the thread the user is looking at never shows it.
    var replied = false;
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == '/api/v1/groups/shares/reply') {
        replied = true;
        return {...replyJson('r-new'), 'body': 'Trông ngon thật'};
      }
      if (request.path == sharePath('s9')) {
        return shareJson(
          fallbackEntry(
            's9',
            replies:
                replied
                    ? [
                      {...replyJson('r-new'), 'body': 'Trông ngon thật'},
                    ]
                    : const [],
          ),
        );
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's9'),
      api: api,
    );

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'Trông ngon thật',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply').last);
    await tester.pumpAndSettle();

    expect(find.byType(ReplyRow), findsOneWidget);
    expect(find.text('Trông ngon thật'), findsOneWidget);
    // Once on arrival, once after the reply: the refetch is what carries the
    // server's `repliesTotal + 1` onto the page.
    expect(shareFetches(api, 's9'), hasLength(2));
    expect(find.text('Phở bò tái'), findsOneWidget);
  });

  testWidgets('Try again refetches the share, not just the feed', (
    tester,
  ) async {
    // What "Try again" owes on this page: the SHARE is asked for again, not
    // only the feed. The page shows one error card for both sources, and the
    // fallback is the one that failed here — it is the only source a post the
    // feed never carried has.
    //
    // This pins the contract, not the wiring: it holds both with and without
    // the screen's explicit `sharedMealEntryProvider` invalidation, because
    // the feed's own rebuild drops the page to [ThreadLoading], unwatches the
    // autoDispose fetch and re-runs it coming back. The point is that the
    // button must still work the day that teardown stops happening.
    var failing = true;
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == sharePath('s9')) {
        if (failing) throw Exception('connection closed');
        return shareJson(fallbackEntry('s9'));
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's9'),
      api: api,
    );
    expect(find.byType(CircleErrorCard), findsOneWidget);

    // Counted rather than asserted at a fixed number: a transport failure is
    // retried inside the provider before it ever reaches the card.
    final before = shareFetches(api, 's9').length;
    failing = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(shareFetches(api, 's9').length, greaterThan(before));
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(find.byType(CircleErrorCard), findsNothing);
  });

  group('threadEntryProvider', () {
    test('answers out of the feed when it can, by id when it cannot', () async {
      final api = FakeApiClient((request) {
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('s1')], null);
        }
        if (request.path == sharePath('s-gone')) {
          throw ApiError('NOT_FOUND', 404, false, 'không tìm thấy');
        }
        return unexpectedRequest(request);
      });
      final container = makeContainer(api);
      await mountFeed(container, null);

      const key = (scope: null, shareId: 's1');
      holdProvider(container, threadEntryProvider(key));
      expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());
      // A post the feed carries is answered from it alone — no fetch.
      expect(api.requests.where((r) => r.path == sharePath('s1')), isEmpty);

      // A share the feed never carried is asked for by id, and a 404 settles
      // it as missing — the state the page shows as "isn't here any more".
      const gone = (scope: null, shareId: 's-gone');
      holdProvider(container, threadEntryProvider(gone));
      expect(container.read(threadEntryProvider(gone)), isA<ThreadLoading>());
      await container.read(sharedMealEntryProvider('s-gone').future);
      expect(container.read(threadEntryProvider(gone)), isA<ThreadMissing>());
    });
  });
}
