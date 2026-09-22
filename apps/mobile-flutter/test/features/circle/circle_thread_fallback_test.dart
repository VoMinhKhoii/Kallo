import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/share_entry_provider.dart';
import 'package:kallo_mobile/features/circle/data/thread_providers.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_error.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_skeleton.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';
import 'package:kallo_mobile/models/http/api_error.dart';

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

  testWidgets('pulling a fallback post down keeps the draft and the post', (
    tester,
  ) async {
    // The regression this exists for (found by review, 2026-09-22): the page
    // refreshed BOTH sources, and for a post the feed never carried that is
    // actively harmful. `findShareEntry` returns null, so the invalidated
    // feed's own `isLoading` answers `ThreadLoading` before `threadEntryProvider`
    // reaches the fallback still holding the post — and the page drops to the
    // skeleton, unmounting the composer and disposing the controller with the
    // user's half-typed reply in it.
    //
    // The feed request is GATED so the refresh is genuinely in flight across a
    // pumped frame. Without that this test passes against the bug: the fake
    // client resolves inside a microtask, so the loading window never reaches
    // a frame and nothing ever unmounts. On a device that window is a real
    // round trip, which is the whole point.
    Completer<void>? gate;
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        await gate?.future;
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
      // A tight, page-sized box: the pull is a scroll gesture, and a loose
      // `home` lets the body shrink-wrap with nothing to overscroll.
      expand: true,
    );
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(shareFetches(api, 's9'), hasLength(1));

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'đang gõ dở',
    );
    await tester.pumpAndSettle();

    gate = Completer<void>();
    // Past `CupertinoSliverRefreshControl.refreshTriggerPullDistance` (100),
    // held rather than flung.
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Phở bò tái')),
    );
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Mid-refresh, with any feed request still hanging on the gate.
    expect(
      find.byType(CircleWallSkeleton),
      findsNothing,
      reason: 'the post must not leave the screen while its refresh is running',
    );
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      'đang gõ dở',
      reason: 'the draft has to survive a refresh of the post it answers',
    );

    gate.complete();
    await tester.pumpAndSettle();

    // The source the page actually reads was refetched; the feed, which does
    // not carry this post, was never asked again.
    expect(shareFetches(api, 's9'), hasLength(2));
    expect(
      api.requests.where((r) => r.path == '/api/v1/groups/friends/feed'),
      hasLength(1),
    );
  });

  testWidgets('pulling a post from a LATER FEED PAGE keeps the draft too', (
    tester,
  ) async {
    // The same loss by the one door the fix above does not cover (found by a
    // second review pass, 2026-09-22). Here the feed DOES carry the post — it
    // came in on page 2 — so `refreshThread` correctly refreshes the feed. But
    // `SharedMealFeedNotifier.build()` fetches page 1 and nothing else, so the
    // refetch REPLACES both loaded pages with the first one and the post is no
    // longer in it. `threadEntryProvider` falls through to a cold by-id fetch
    // and answers `ThreadLoading` — and a page that swapped in [ThreadStates]
    // for that would take the composer, and the draft, down with it.
    //
    // Fixed on the SCREEN rather than in `refreshThread`: a page that has shown
    // a post holds it while a refetch runs underneath. Both reported doors, and
    // the third nobody has found yet, close at once.
    Completer<void>? gate;
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], 'cursor-1');
      }
      if (request.path == '/api/v1/groups/friends/feed?before=cursor-1') {
        return pageJson([fallbackEntry('s9')], null);
      }
      if (request.path == sharePath('s9')) {
        await gate?.future;
        return shareJson(fallbackEntry('s9'));
      }
      return readMarker(request);
    });

    // The thread page is MOUNTED SECOND, over a feed that already holds both
    // pages — the real order, and the only one that reproduces this. A thread
    // page mounted first would find page 1 settled without the post and go
    // straight to the by-id fallback, which is the other test's story.
    final opened = ValueNotifier(false);
    addTearDown(opened.dispose);
    await pumpCircleScreen(
      tester,
      Column(
        children: [
          const _FeedKeepAlive(),
          Expanded(
            child: ValueListenableBuilder<bool>(
              valueListenable: opened,
              builder:
                  (context, open, _) =>
                      open
                          ? const CircleThreadScreen(shareId: 's9')
                          : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
      api: api,
      // A tight, page-sized box: the pull is a scroll gesture, and a loose
      // `home` lets the body shrink-wrap with nothing to overscroll.
      expand: true,
    );

    // Scrolling the Circle tab to page 2 — where the post the user then taps
    // lives.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(_FeedKeepAlive)),
    );
    await container.read(sharedMealFeedProvider(null).notifier).loadMore();
    await tester.pumpAndSettle();

    opened.value = true;
    await tester.pumpAndSettle();
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(
      shareFetches(api, 's9'),
      isEmpty,
      reason: 'the feed carries this post, so the page reads it from there',
    );

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'đang gõ dở',
    );
    await tester.pumpAndSettle();

    // Gated so the cold by-id fetch is genuinely in flight across a pumped
    // frame: the fake client otherwise resolves in a microtask and the window
    // this test is about never reaches a frame. On a device it is a round trip.
    gate = Completer<void>();
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Phở bò tái')),
    );
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // The feed has settled back to page 1 by now — the post is no longer in
    // it, and the by-id fetch that replaces it is still hanging on the gate.
    expect(
      find.byType(CircleWallSkeleton),
      findsNothing,
      reason: 'the post must not leave the screen while its refresh is running',
    );
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      'đang gõ dở',
      reason: 'the draft has to survive a refresh of the post it answers',
    );

    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      'đang gõ dở',
    );
  });

  testWidgets('a refresh that FAILS keeps the post and the draft', (
    tester,
  ) async {
    // The gap the first cut of the hold left open (found by review, 2026-09-22):
    // masking only `ThreadLoading` still tore the page down when the cold by-id
    // fetch that replaces a page-2 post failed. `ThreadFailed` says nothing
    // about whether the post exists — telling someone their friend's meal is
    // gone, and throwing away their half-typed reply, because the train went
    // into a tunnel is a lie they cannot undo.
    //
    // Note what is NOT asserted away: the two cold-load tests below still get
    // their error card and their gone state. The hold needs a post to have been
    // shown before it does anything.
    var shareFails = true;
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], 'cursor-1');
      }
      if (request.path == '/api/v1/groups/friends/feed?before=cursor-1') {
        return pageJson([fallbackEntry('s9')], null);
      }
      if (request.path == sharePath('s9')) {
        if (shareFails) throw Exception('connection closed');
        return shareJson(fallbackEntry('s9'));
      }
      return readMarker(request);
    });

    final opened = ValueNotifier(false);
    addTearDown(opened.dispose);
    await pumpCircleScreen(
      tester,
      Column(
        children: [
          const _FeedKeepAlive(),
          Expanded(
            child: ValueListenableBuilder<bool>(
              valueListenable: opened,
              builder:
                  (context, open, _) =>
                      open
                          ? const CircleThreadScreen(shareId: 's9')
                          : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
      api: api,
      expand: true,
    );

    final container = ProviderScope.containerOf(
      tester.element(find.byType(_FeedKeepAlive)),
    );
    await container.read(sharedMealFeedProvider(null).notifier).loadMore();
    await tester.pumpAndSettle();

    opened.value = true;
    await tester.pumpAndSettle();
    expect(find.text('Phở bò tái'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'đang gõ dở',
    );
    await tester.pumpAndSettle();

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Phở bò tái')),
    );
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pumpAndSettle();

    // The refresh has failed and settled. The page keeps what it had and says
    // nothing — the same answer a failed pull on the Circle feed gives
    // (`circle_screen.dart`, `_refresh`, which swallows its error too).
    expect(find.byType(CircleErrorCard), findsNothing);
    expect(find.byType(CircleWallSkeleton), findsNothing);
    expect(find.text('Phở bò tái'), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      'đang gõ dở',
      reason: 'a transport failure is not a reason to throw away a draft',
    );

    // And it is still a live page, not a frozen one: a pull that succeeds
    // afterwards brings the post back through the fallback.
    shareFails = false;
    final retry = await tester.startGesture(
      tester.getCenter(find.text('Phở bò tái')),
    );
    for (var i = 0; i < 15; i++) {
      await retry.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await retry.up();
    await tester.pumpAndSettle();
    expect(find.text('Phở bò tái'), findsOneWidget);
  });

  testWidgets('a share swapped in under a kept state shows NEITHER old thing', (
    tester,
  ) async {
    // `MaterialPage` in `router.dart` carries no key, so `Navigator` updates
    // the existing route rather than building a new one when this page is
    // asked for a different share — tapping a notification while already
    // reading a thread. `shareId` changes under a [State] that is kept.
    //
    // Two ways that goes wrong, and this pins both (caught in review,
    // 2026-09-22): the held post would be shown for the new thread while it
    // loads, and the composer's own controller would carry the previous
    // thread's draft into a field now addressed to this one. Post A on screen,
    // A's words in the box, and the dock already posting to B.
    Completer<void>? gate;
    final api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends/feed') {
        return pageJson([entryJson('s1')], null);
      }
      if (request.path == sharePath('s9')) {
        return shareJson(fallbackEntry('s9'));
      }
      if (request.path == sharePath('s8')) {
        await gate?.future;
        return shareJson(fallbackEntry('s8', rawInput: 'Cơm tấm sườn'));
      }
      return readMarker(request);
    });

    final shareId = ValueNotifier('s9');
    addTearDown(shareId.dispose);
    await pumpCircleScreen(
      tester,
      ValueListenableBuilder<String>(
        valueListenable: shareId,
        // Same widget type, same position, no key: exactly what the router
        // does, so the element — and its State — is reused.
        builder: (context, id, _) => CircleThreadScreen(shareId: id),
      ),
      api: api,
      expand: true,
    );
    expect(find.text('Phở bò tái'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'trả lời bài A',
    );
    await tester.pumpAndSettle();

    // The second thread's read is held open, which is the whole window: this
    // is the state the page is in while it loads a share it has never shown.
    gate = Completer<void>();
    shareId.value = 's8';
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(
      find.text('Phở bò tái'),
      findsNothing,
      reason: 'the previous thread may not stand in for the one being loaded',
    );
    final composer = find.byKey(const Key('reply-composer'));
    if (composer.evaluate().isNotEmpty) {
      expect(
        tester.widget<TextField>(composer).controller?.text,
        isEmpty,
        reason: 'a draft written to one post may never be addressed to another',
      );
    }

    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Cơm tấm sườn'), findsOneWidget);
    expect(find.text('Phở bò tái'), findsNothing);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      isEmpty,
      reason: 'the new thread opens with an empty field, as a fresh page would',
    );
  });

  testWidgets('a draft never follows the viewer from one thread to another', (
    tester,
  ) async {
    // The other half of the kept-state swap, and the half no loading window
    // covers: BOTH shares are already in the feed, so the new thread is
    // `ThreadReady` on the very frame the id changes. Nothing unmounts, the
    // composer's element is reused, and without a key on the thread its
    // [TextEditingController] hands the previous post's words to a dock that
    // now posts somewhere else.
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([
                entryJson('s1'),
                fallbackEntry('s2', rawInput: 'Cơm tấm sườn'),
              ], null)
              : readMarker(request),
    );

    final shareId = ValueNotifier('s1');
    addTearDown(shareId.dispose);
    await pumpCircleScreen(
      tester,
      ValueListenableBuilder<String>(
        valueListenable: shareId,
        builder: (context, id, _) => CircleThreadScreen(shareId: id),
      ),
      api: api,
      expand: true,
    );
    expect(find.text('Bún chả Hà Nội'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'trả lời bài A',
    );
    await tester.pumpAndSettle();

    shareId.value = 's2';
    await tester.pumpAndSettle();

    // No skeleton was ever shown — this is the synchronous path.
    expect(find.text('Cơm tấm sườn'), findsOneWidget);
    expect(find.text('Bún chả Hà Nội'), findsNothing);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('reply-composer')))
          .controller
          ?.text,
      isEmpty,
      reason: 'a reply half-written to one post may not arrive at another',
    );
  });

  testWidgets('a thread swapped in under a kept state opens at ITS top', (
    tester,
  ) async {
    // The kept [ScrollController], third of the things a keyless `MaterialPage`
    // hands from one thread to the next. Read halfway down thread A, tap a
    // notification for B, and B opened at A's offset with its post header off
    // screen (caught in review, 2026-09-22).
    //
    // Both shares are in the feed so the swap is synchronous — the case that
    // needs the reset. A thread that has to load shows [ThreadStates] first,
    // which has no scrollable, so the controller detaches and starts at zero.
    List<Map<String, dynamic>> replies(String prefix) => [
      for (var i = 0; i < 12; i++) replyJson('$prefix-r$i'),
    ];
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([
                entryJson('s1', replies: replies('a')),
                fallbackEntry(
                  's2',
                  rawInput: 'Cơm tấm sườn',
                  replies: replies('b'),
                ),
              ], null)
              : readMarker(request),
    );

    final shareId = ValueNotifier('s1');
    addTearDown(shareId.dispose);
    await pumpCircleScreen(
      tester,
      ValueListenableBuilder<String>(
        valueListenable: shareId,
        builder: (context, id, _) => CircleThreadScreen(shareId: id),
      ),
      api: api,
      expand: true,
    );

    await tester.drag(find.byType(FeedEntry), const Offset(0, -200));
    await tester.pumpAndSettle();
    final scrolled = tester.widget<Scrollable>(find.byType(Scrollable).first);
    expect(
      scrolled.controller?.offset,
      greaterThan(0),
      reason: 'the test has to actually leave the top of thread A',
    );

    shareId.value = 's2';
    await tester.pumpAndSettle();

    expect(find.text('Cơm tấm sườn'), findsOneWidget);
    expect(
      tester
          .widget<Scrollable>(find.byType(Scrollable).first)
          .controller
          ?.offset,
      0,
      reason: 'a thread opens at its own beginning, not where the last one was',
    );
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
    await tester.tap(find.byKey(const Key('reply-send')));
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

  group('refreshThread', () {
    test('a page-two refresh waits for the fetch it causes', () async {
      // What the pull's inset means: "still working". `refreshThread` used to
      // return the moment page 1 of the feed landed — but for a post that came
      // in through `loadMore()` that response is what REMOVES the post and
      // starts a cold by-id fetch, which has its own 15-second timeout. The
      // control collapsed over content that had not been refreshed at all
      // (found in review, 2026-09-22).
      final gate = Completer<void>();
      final api = FakeApiClient((request) async {
        if (request.path == '/api/v1/groups/friends/feed') {
          return pageJson([entryJson('s1')], 'cursor-1');
        }
        if (request.path == '/api/v1/groups/friends/feed?before=cursor-1') {
          return pageJson([entryJson('s9')], null);
        }
        if (request.path == sharePath('s9')) {
          await gate.future;
          return shareJson(entryJson('s9'));
        }
        return readMarker(request);
      });
      final container = makeContainer(api);
      await mountFeed(container, null);
      await container.read(sharedMealFeedProvider(null).notifier).loadMore();

      const key = (scope: null, shareId: 's9');
      holdProvider(container, threadEntryProvider(key));
      expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());

      var settled = false;
      final pull = refreshThread(
        ContainerWidgetRef(container),
        key,
      ).whenComplete(() => settled = true);

      // Long enough for the feed's own page-1 request to land and for the page
      // to fall through to the fallback — the exact moment the pull used to
      // report itself done.
      await pumpEventQueue();
      expect(container.read(threadEntryProvider(key)), isA<ThreadLoading>());
      expect(
        settled,
        isFalse,
        reason: 'the pull may not collapse over a post still in flight',
      );

      gate.complete();
      await pull;
      expect(settled, isTrue);
      expect(container.read(threadEntryProvider(key)), isA<ThreadReady>());
    });
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

/// The Circle tab sitting under the thread page: something has to keep the
/// paginated feed alive while the page reads a post out of it, and on a device
/// that something is the tab shell the page was pushed over.
class _FeedKeepAlive extends ConsumerWidget {
  const _FeedKeepAlive();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(sharedMealFeedProvider(null));
    return const SizedBox.shrink();
  }
}
