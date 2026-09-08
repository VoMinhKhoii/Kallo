import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/logic/circle_thread_route.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_pressable.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// Threads' post anatomy: the WHOLE post is the thread's tap target, and the
/// glyphs inside it keep their own taps. The feed's post opens the thread; the
/// thread page's copy of the same post does not, because it is already there.
///
/// A real [GoRouter] rather than a mock navigator: what is under test is where
/// a tap LANDS — path plus query — and `compose=1` rides in the URL, so an
/// observer that only records "pushed something" would pass on the bug this
/// exists to catch (the post opening a focused composer it never asked for).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  CircleFeedEntry entry({String shareId = 's1'}) => CircleFeedEntry(
    friend: const CircleProfile(
      userId: 'u2',
      handle: 'mai',
      displayName: 'Mai',
    ),
    isSelf: false,
    meal: CircleFeedMeal(
      mealId: 'm1',
      shareId: shareId,
      rawInput: 'Bún chả Hà Nội',
      sharedAt: DateTime.now().toUtc().toIso8601String(),
      caloriesKcal: 540,
      proteinG: 38,
      carbohydrateG: 62,
      fatG: 14,
    ),
    reactions: const ShareReactions(count: 2),
  );

  /// The calls a heart tap makes on its way out: the alive-feed scan reads the
  /// chat-group list, the feed itself is served so there is a cache to splice
  /// the optimistic count into, then the reaction posts.
  FakeApiClient quietApi() => FakeApiClient((request) {
    if (request.path.startsWith('/api/v1/chat-groups')) {
      return <String, dynamic>{'groups': <dynamic>[]};
    }
    if (request.path == '/api/v1/groups/shares/reaction') {
      return <String, dynamic>{'reacted': true, 'count': 4};
    }
    if (request.method == 'GET' &&
        request.path.startsWith('/api/v1/groups/friends/feed')) {
      return pageJson([entryJson('s1', count: 2)], null);
    }
    return readMarker(request);
  });

  /// A post wired the way the FEED wires it (`feed_day_group.dart`): the post
  /// opens its thread, the reply glyph opens it with `compose=1`. Navigation
  /// left [FeedEntry] on 2026-09-08 — it takes both as callbacks now — so the
  /// composition under test lives here rather than inside the widget.
  Widget feedPost(CircleFeedEntry data) => Builder(
    builder:
        (context) => FeedEntry(
          entry: data,
          onOpen: () => openCircleThread(context, shareId: data.meal.shareId),
          onReply:
              () => openCircleThread(
                context,
                shareId: data.meal.shareId,
                compose: true,
              ),
        ),
  );

  /// Where the router actually is. A PUSH leaves the delegate's own
  /// `currentConfiguration.uri` on the page it was pushed FROM and records the
  /// destination as an [ImperativeRouteMatch] at the end of the match list —
  /// so reading the configuration directly reports `/` for every one of these
  /// taps and the test would pass on a navigation that never happened.
  String locationOf(GoRouter router) {
    final config = router.routerDelegate.currentConfiguration;
    final last = config.matches.last;
    return (last is ImperativeRouteMatch ? last.matches : config).uri
        .toString();
  }

  /// The feed at `/`, the thread page at `/circle/:shareId` — the two real
  /// routes `router.dart` declares, reduced to what a tap can be seen to hit.
  Future<GoRouter> pumpFeed(
    WidgetTester tester,
    Widget post, {
    FakeApiClient? api,
  }) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder:
              (_, _) => Scaffold(
                // A scroll view, and a column narrower than the screen: the
                // real feed hands a post UNBOUNDED height (a ListView) and a
                // finite width (the day card), and a post laid out against a
                // finite height stretches its column to fill it.
                body: SingleChildScrollView(
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: SizedBox(width: 500, child: post),
                  ),
                ),
              ),
        ),
        GoRoute(
          path: '/circle/:shareId',
          builder:
              (context, state) => Scaffold(
                body: Text(
                  'thread ${state.pathParameters['shareId']} '
                  'compose=${state.uri.queryParameters['compose']}',
                ),
              ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await pumpCircleRouter(tester, router, api: api ?? quietApi());
    return router;
  }

  testWidgets('tapping the post opens its thread with no composer', (
    tester,
  ) async {
    final router = await pumpFeed(tester, feedPost(entry()));
    expect(locationOf(router), '/');

    await tester.tap(find.text('Bún chả Hà Nội'));
    await tester.pumpAndSettle();

    // The post itself, not the reply glyph: the thread opens READ-first, so
    // no `compose` and no keyboard on arrival.
    expect(locationOf(router), '/circle/s1');
    expect(find.text('thread s1 compose=null'), findsOneWidget);
  });

  testWidgets('the post is as wide as the column it sits in', (tester) async {
    // The pressable shrink-wraps (see its *Sizing* doc), so a target that
    // hugged the text would leave most of the post dead to a tap. The Row's
    // Expanded child is what keeps it column-wide.
    await pumpFeed(tester, feedPost(entry()));
    expect(tester.getSize(find.byType(KalloPressable).first).width, 500);
  });

  testWidgets('the heart reacts and does not open the thread', (tester) async {
    // Off the LIVE feed, not a literal entry: the optimistic count lands in
    // the feed provider's cache, so a hardcoded post would swallow the proof
    // that the heart — and not the post behind it — took the tap.
    final router = await pumpFeed(tester, const _LiveFeedPost());
    expect(find.text('2'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.heart300));
    await tester.pumpAndSettle();

    expect(locationOf(router), '/');
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('a heart mid-request does not open the thread', (tester) async {
    // The heart drops its `onTap` while its reaction is in flight, and it
    // sits inside the post's own tap target. A disabled glyph that let the
    // press through would hand the SECOND of two quick heart taps to the post
    // — the thread opening from a double tap on the heart (2026-09-08).
    final pending = Completer<Map<String, dynamic>>();
    final api = FakeApiClient((request) {
      if (request.path == '/api/v1/groups/shares/reaction') {
        return pending.future;
      }
      if (request.path.startsWith('/api/v1/chat-groups')) {
        return <String, dynamic>{'groups': <dynamic>[]};
      }
      return readMarker(request);
    });
    final router = await pumpFeed(tester, feedPost(entry()), api: api);

    final heart = find.byIcon(LucideIcons.heart300);
    await tester.tap(heart);
    await tester.pump();
    // The request is still open, so the glyph is disabled — and takes the
    // next tap itself rather than passing it up.
    await tester.tap(heart);
    await tester.pump();

    expect(locationOf(router), '/');

    pending.complete(<String, dynamic>{'reacted': true, 'count': 4});
    await tester.pumpAndSettle();
    expect(locationOf(router), '/');
  });

  testWidgets('the reply glyph opens the thread WITH the composer', (
    tester,
  ) async {
    final router = await pumpFeed(tester, feedPost(entry()));

    await tester.tap(find.byIcon(LucideIcons.messageCircle300));
    await tester.pumpAndSettle();

    expect(locationOf(router), '/circle/s1?compose=1');
    expect(find.text('thread s1 compose=1'), findsOneWidget);
  });

  testWidgets('the thread page copy of the post opens nothing', (tester) async {
    // No `onOpen` at all — how `thread/thread_body.dart` draws the post it is
    // already the thread for. Its reply glyph focuses that page's own
    // composer, which navigates nowhere either.
    final router = await pumpFeed(
      tester,
      FeedEntry(entry: entry(), onReply: () {}),
    );

    await tester.tap(find.text('Bún chả Hà Nội'));
    await tester.pumpAndSettle();

    expect(locationOf(router), '/');
  });

  testWidgets('the post is announced as a button, and only in the feed', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();

    await pumpFeed(tester, feedPost(entry()));
    expect(find.bySemanticsLabel('Open thread'), findsOneWidget);

    await pumpFeed(tester, FeedEntry(entry: entry(), onReply: () {}));
    expect(find.bySemanticsLabel('Open thread'), findsNothing);

    handle.dispose();
  });

  testWidgets('the announced post node is the one that opens the thread', (
    tester,
  ) async {
    // A screen reader activates the node it just announced. The annotation
    // used to carry the button trait and the name while the tap sat on the
    // [KalloPressable]'s own node UNDER it, so "Open thread, button" did
    // nothing and the node that did navigate was read out as raw post text.
    final handle = tester.ensureSemantics();
    final router = await pumpFeed(tester, feedPost(entry()));

    // Over the SEMANTICS tree, not the widget tree: what a screen reader can
    // reach is a property of the nodes, and the widget finders would keep
    // passing on an annotation that names a node it cannot activate.
    final post = find.semantics.byLabel('Open thread');
    expect(post, findsOne);
    expect(
      post.evaluate().single,
      isSemantics(isButton: true, hasTapAction: true),
    );

    // The glyphs are still nodes of their own inside the post — the heart
    // keeps its name AND its count, so the annotation has not swallowed the
    // action row on its way to owning the tap.
    final heart = find.semantics.byLabel(RegExp('^Heart'));
    expect(heart, findsOne);
    expect(
      heart.evaluate().single,
      isSemantics(isButton: true, hasTapAction: true),
    );
    expect(heart.evaluate().single.label, contains('2'));

    // Activation as VoiceOver performs it — the action dispatched to the
    // announced node's own id. `tester.tap` lands on the pressable under it
    // and would pass either way.
    tester.semantics.performAction(post, SemanticsAction.tap);
    await tester.pumpAndSettle();

    expect(locationOf(router), '/circle/s1');
    handle.dispose();
  });
}

/// The post as the feed really draws it: read out of [sharedMealFeedProvider],
/// so a mutation that splices into that cache is visible here.
class _LiveFeedPost extends ConsumerWidget {
  const _LiveFeedPost();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(sharedMealFeedProvider(null));
    return feed.when(
      data:
          (value) => FeedEntry(
            entry: value.entries.single,
            onOpen:
                () => openCircleThread(
                  context,
                  shareId: value.entries.single.meal.shareId,
                ),
            onReply: () {},
          ),
      error: (_, _) => const Text('error'),
      loading: () => const CircularProgressIndicator(),
    );
  }
}
