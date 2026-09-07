import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/thread_providers.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';

import 'circle_feed_test_support.dart';

/// The Circle thread page — one post and its replies on their own route.
///
/// Its defining property is that it does NOT fetch: there is no single-share
/// endpoint, so it reads its post out of the feed it was opened from. Most of
/// what is worth pinning here follows from that.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  Iterable<Request> feedFetches(FakeApiClient api) =>
      api.requests.where((r) => r.path == '/api/v1/groups/friends/feed');

  testWidgets('the thread reads its post out of the live feed, not an API', (
    tester,
  ) async {
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([
                entryJson('s1', replies: [replyJson('r1')]),
              ], null)
              : readMarker(request),
    );
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );

    expect(find.text('Bún chả Hà Nội'), findsOneWidget);
    expect(find.byType(ReplyRow), findsOneWidget);
    // One feed fetch, and nothing that names a share: no endpoint exists to
    // fetch one, and the page must not invent a call that would 404.
    expect(feedFetches(api), hasLength(1));
    expect(api.requests.where((r) => r.path.contains('s1')), isEmpty);
  });

  testWidgets('a reply posted here appends without a second feed fetch', (
    tester,
  ) async {
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == '/api/v1/groups/shares/reply') {
        return {...replyJson('r-new'), 'body': 'Trông ngon thật'};
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'Trông ngon thật',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply').last);
    await tester.pumpAndSettle();

    expect(find.text('Trông ngon thật'), findsOneWidget);
    // The reply was posted once and the feed was NOT refetched: the append
    // into the feed cache is what the page is watching.
    expect(
      api.requests.where((r) => r.path == '/api/v1/groups/shares/reply'),
      hasLength(1),
    );
    expect(feedFetches(api), hasLength(1));
  });

  testWidgets('a post that is not in the feed shows the gone state', (
    tester,
  ) async {
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([entryJson('s1')], null)
              : readMarker(request),
    );
    await pumpCircleScreen(
      tester,
      // A share the feed page does not carry — deleted, or older than page 1.
      const CircleThreadScreen(shareId: 's-missing'),
      api: api,
    );

    expect(find.text("This post isn't here any more"), findsOneWidget);
    // It says so rather than closing itself: a screen that pops under the
    // user's thumb reads as a crash.
    expect(find.byType(CircleThreadScreen), findsOneWidget);
  });

  testWidgets('the earlier-replies line states what the API withheld', (
    tester,
  ) async {
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([
                entryJson(
                  's1',
                  replies: [replyJson('r1'), replyJson('r2')],
                  repliesTotal: 9,
                ),
              ], null)
              : readMarker(request),
    );
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );

    // 9 total, 2 shipped: the page owns this line because the thread is where
    // the missing 7 would otherwise be silently absent.
    expect(find.text('7 earlier replies'), findsOneWidget);
  });

  testWidgets('one withheld reply reads as one, not as "1 earlier replies"', (
    tester,
  ) async {
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([
                entryJson('s1', replies: [replyJson('r1')], repliesTotal: 2),
              ], null)
              : readMarker(request),
    );
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );

    // The key is a plural map, so the line has to go through `plural` — `tr`
    // would print the map's own shape.
    expect(find.text('1 earlier reply'), findsOneWidget);
  });

  group('the composer opens focused only when the URL asks', () {
    Future<bool> composerFocused(WidgetTester tester) async =>
        tester
            .widget<TextField>(find.byKey(const Key('reply-composer')))
            .focusNode!
            .hasFocus;

    FakeApiClient feedApi() => FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([entryJson('s1')], null)
              : readMarker(request),
    );

    testWidgets('autofocusComposer raises the keyboard on arrival', (
      tester,
    ) async {
      // What `?compose=1` buys: the reply glyph used to open a composer, and
      // the page it pushes now has to do the same thing.
      await pumpCircleScreen(
        tester,
        const CircleThreadScreen(shareId: 's1', autofocusComposer: true),
        api: feedApi(),
      );
      expect(await composerFocused(tester), isTrue);
    });

    testWidgets('arriving any other way leaves the field cold', (tester) async {
      await pumpCircleScreen(
        tester,
        const CircleThreadScreen(shareId: 's1'),
        api: feedApi(),
      );
      expect(await composerFocused(tester), isFalse);
    });
  });

  testWidgets('a reply from a group thread lands in that group\'s feed', (
    tester,
  ) async {
    // The Circle tab selects nothing here — a cold deep link into a group
    // post. The alive-scope set is built from the SELECTION, so without the
    // caller's own scope the reply splices into no feed at all and the user
    // watches what they just wrote disappear.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/chat-groups/g1/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path.startsWith('/api/v1/chat-groups?')) {
        return {'groups': <Map<String, dynamic>>[]};
      }
      if (request.path == '/api/v1/groups/shares/reply') {
        return {...replyJson('r-new'), 'body': 'Trông ngon thật'};
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1', scope: 'g1'),
      api: api,
    );

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'Trông ngon thật',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply').last);
    await tester.pumpAndSettle();

    expect(find.text('Trông ngon thật'), findsOneWidget);
  });

  testWidgets('a heart from a group thread lands in that group\'s feed', (
    tester,
  ) async {
    // The reply's twin: the post's own action row is drawn by the same
    // [FeedEntry] the feed uses, and it must carry the thread's scope too, or
    // a heart tapped on a cold deep link toggles in no feed and the glyph
    // never fills.
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/chat-groups/g1/feed') {
        return pageJson([entryJson('s1', count: 2)], null);
      }
      if (request.path.startsWith('/api/v1/chat-groups?')) {
        return {'groups': <Map<String, dynamic>>[]};
      }
      if (request.path == '/api/v1/groups/shares/reaction') {
        return {'reacted': true, 'count': 3};
      }
      return readMarker(request);
    });
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1', scope: 'g1'),
      api: api,
    );

    await tester.tap(find.byIcon(LucideIcons.heart300));
    await tester.pumpAndSettle();

    expect(find.text('3'), findsOneWidget);
    expect(tester.widget<Icon>(find.byIcon(LucideIcons.heart300)).fill, 1);
  });

  group('threadEntryProvider', () {
    test('keeps a post on screen while its feed refreshes', () async {
      final api = FakeApiClient(
        (request) =>
            request.path == '/api/v1/groups/friends/feed'
                ? pageJson([entryJson('s1')], null)
                : unexpectedRequest(request),
      );
      final container = makeContainer(api);
      await mountFeed(container, null);

      const key = (scope: null, shareId: 's1');
      holdProvider(container, threadEntryProvider(key));
      expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());

      // A share the feed never carried settles as missing, not as loading.
      const gone = (scope: null, shareId: 's-gone');
      holdProvider(container, threadEntryProvider(gone));
      expect(container.read(threadEntryProvider(gone)), isA<ThreadMissing>());
    });
  });
}
