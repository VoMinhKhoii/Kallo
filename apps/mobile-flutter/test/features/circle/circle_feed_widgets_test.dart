import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/shared/logic/display_format.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_action_button.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_day_group.dart';
import 'package:kallo_mobile/features/circle/logic/circle_spacing.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';
import 'package:kallo_mobile/shared/widgets/icons/filled_heart.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/composition_bar.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_rhythm.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

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

  ShareReply reply({
    String id = 'r1',
    String body = 'Ngon quá!',
    bool isSelf = false,
  }) => ShareReply(
    id: id,
    author: const CircleProfile(userId: 'u3', handle: 'linh', avatarUrl: null),
    isSelf: isSelf,
    body: body,
    createdAt: DateTime.now(),
  );

  CircleFeedEntry entry({
    String mealId = 'm1',
    String shareId = 's1',
    String rawInput = 'Bún chả Hà Nội',
    bool self = false,
    double portion = 1,
    double? protein = 38,
    int repliesTotal = 0,
    List<ShareReply> replies = const [],
    ShareReactions reactions = const ShareReactions(),
    DateTime? sharedAt,
    bool isBackfilled = false,
  }) => CircleFeedEntry(
    friend: const CircleProfile(
      userId: 'u2',
      handle: 'mai',
      displayName: 'Mai',
      avatarUrl: null,
    ),
    isSelf: self,
    meal: CircleFeedMeal(
      mealId: mealId,
      shareId: shareId,
      rawInput: rawInput,
      sharedAt: (sharedAt ?? DateTime.now()).toUtc().toIso8601String(),
      caloriesKcal: 540,
      proteinG: protein,
      carbohydrateG: protein == null ? null : 62,
      fatG: protein == null ? null : 14,
      portionFactor: portion,
      isBackfilled: isBackfilled,
    ),
    reactions: reactions,
    replies: replies,
    repliesTotal: repliesTotal,
  );

  Future<void> pump(
    WidgetTester tester,
    Widget child, {
    List<Override> overrides = const [],
  }) async {
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => ProviderScope(
                overrides: overrides,
                child: MaterialApp(
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                  home: Scaffold(body: child),
                ),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// A post as the FEED composes it: navigation lives in `feed_day_group.dart`
  /// now, so a bare [FeedEntry] takes both actions as callbacks. Both are
  /// no-ops here — nothing in this file taps the post — but [onOpen] stays
  /// non-null so the post keeps the button node the semantics tests read.
  Widget post(CircleFeedEntry data) =>
      FeedEntry(entry: data, onOpen: () {}, onReply: () {});

  testWidgets(
    'entry preserves diacritics and renders macros, kcal, and a missing macro',
    (tester) async {
      await pump(tester, post(entry()));
      expect(find.textContaining('Mai'), findsOneWidget);
      expect(find.text('Bún chả Hà Nội'), findsOneWidget);
      expect(find.text('P 38g'), findsOneWidget);
      expect(find.textContaining('540 kcal'), findsOneWidget);

      // A missing macro reads as an em dash, not the long "no data" string:
      // three of those in one row wraps the line and buries the known figures.
      await pump(tester, post(entry(protein: null)));
      expect(find.text('P —'), findsOneWidget);
    },
  );

  testWidgets('portion badge only appears below a full portion', (
    tester,
  ) async {
    await pump(tester, post(entry(portion: 0.5)));
    expect(find.text('½ portion'), findsOneWidget);
    await pump(tester, post(entry()));
    expect(find.textContaining('portion'), findsNothing);
  });

  testWidgets('the logged clock time shows, and hides for a backfill', (
    tester,
  ) async {
    // A fixed local instant, so the expectation does not drift with the clock
    // or the machine's zone.
    final loggedAt = DateTime(2026, 8, 13, 15, 2);
    final shown = formatLoggedTime(loggedAt, locale: 'en');

    await pump(tester, post(entry(sharedAt: loggedAt)));
    expect(find.textContaining(shown), findsOneWidget);

    // A backfilled share carries a sharedAt of "now", so its clock time would
    // describe when the meal was typed up rather than when it was eaten.
    await pump(tester, post(entry(sharedAt: loggedAt, isBackfilled: true)));
    expect(find.textContaining(shown), findsNothing);
  });

  testWidgets('Log this too is hidden for self and shown for others', (
    tester,
  ) async {
    await pump(tester, post(entry(self: true)));
    expect(find.text('Log this too'), findsNothing);
    await pump(tester, post(entry()));
    expect(find.text('Log this too'), findsOneWidget);
  });

  testWidgets('heart updates optimistically then reconciles', (tester) async {
    final response = Completer<Map<String, dynamic>>();
    final api = FakeApiClient((request) {
      if (request.method == 'GET') {
        return pageJson([entryJson('s1', count: 2)], null);
      }
      return response.future;
    });
    await pump(
      tester,
      const _FeedHost(),
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    await tester.tap(find.byIcon(LucideIcons.heart300));
    await tester.pump();
    expect(find.text('3'), findsOneWidget);
    // The hearted state is a whole different WIDGET, not a fill on the same
    // Icon: Lucide is a font here and carries no FILL axis, so the old
    // `Icon.fill == 1` assertion passed while the phone drew an outline.
    expect(find.byType(FilledHeart), findsOneWidget);
    expect(find.byIcon(LucideIcons.heart300), findsNothing);
    response.complete({'reacted': true, 'count': 4});
    await tester.pumpAndSettle();
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('heart restores snapshot when the request fails', (tester) async {
    final response = Completer<Map<String, dynamic>>();
    final api = FakeApiClient((request) {
      if (request.method == 'GET') return pageJson([entryJson('s1')], null);
      return response.future;
    });
    await pump(
      tester,
      const _FeedHost(),
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    await tester.tap(find.byIcon(LucideIcons.heart300));
    await tester.pump();
    expect(find.text('3'), findsOneWidget);
    response.completeError(ApiError('NOPE', 500, false, 'failed'));
    await tester.pumpAndSettle();
    expect(find.text('2'), findsOneWidget);
    // Back to the outline glyph, with no filled heart left behind.
    expect(find.byIcon(LucideIcons.heart300), findsOneWidget);
    expect(find.byType(FilledHeart), findsNothing);
  });

  testWidgets('a hearted post draws the filled heart, an unhearted one the '
      'outline', (tester) async {
    await pump(
      tester,
      post(entry(reactions: const ShareReactions(mine: true, count: 3))),
    );
    expect(find.byType(FilledHeart), findsOneWidget);
    expect(find.byIcon(LucideIcons.heart300), findsNothing);

    await pump(tester, post(entry(reactions: const ShareReactions(count: 3))));
    expect(find.byIcon(LucideIcons.heart300), findsOneWidget);
    expect(find.byType(FilledHeart), findsNothing);
  });

  testWidgets('the reply glyph carries the reply count', (tester) async {
    // The count moved onto the glyph when the card stopped drawing replies
    // under the post: it is the only thing left saying a thread exists.
    await pump(tester, post(entry(repliesTotal: 3)));
    expect(find.text('3'), findsOneWidget);
    final glyph = tester.getRect(find.byIcon(LucideIcons.messageCircle300));
    final count = tester.getRect(find.text('3'));
    expect(count.left, greaterThan(glyph.right));
    expect(count.center.dy, closeTo(glyph.center.dy, 2));

    // Zero prints nothing — and since 2026-09-08 the heart's own zero does
    // not either, so a post with neither shows no digits at all.
    await pump(tester, post(entry(repliesTotal: 0)));
    expect(find.text('0'), findsNothing);
  });

  testWidgets('the heart carries its count only above zero', (tester) async {
    // A fresh post read "0" beside the heart — a count of nothing, printed as
    // loudly as a real one, and the first thing on a brand-new post. It
    // follows the reply glyph's rule now. The name is still SPOKEN either
    // way (see the semantics test below), so nothing is lost by hiding it.
    await pump(tester, post(entry(reactions: const ShareReactions())));
    expect(find.text('0'), findsNothing);
    expect(find.byIcon(LucideIcons.heart300), findsOneWidget);

    await pump(tester, post(entry(reactions: const ShareReactions(count: 2))));
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('every action announces as a button, and says its name once', (
    tester,
  ) async {
    // "Log this too" was the one action with a VISIBLE name, and the only one
    // that never announced as a control: [FeedActionButton] wrapped itself in
    // `Semantics(button: true)` only when it had been handed a semanticLabel,
    // so the labelled action fell through as plain tappable text.
    final handle = tester.ensureSemantics();
    await pump(tester, post(entry(reactions: const ShareReactions(count: 2))));

    // An EXACT label match, so a node reading "Log this too\nLog this too"
    // fails: the visible text merges into this button's own node, and naming
    // it again in the Semantics would read the action twice.
    expect(
      find.semantics.byLabel('Log this too'),
      isSemantics(label: 'Log this too', isButton: true),
    );
    // The heart stays ONE node carrying its name, its count and its state —
    // splitting it into "Heart" with a nested "2" is what happens if the row's
    // own Semantics claims `button: true` as well.
    expect(
      find.semantics.byLabel('Heart\n2'),
      isSemantics(label: 'Heart\n2', isButton: true, hasToggledState: true),
    );
    expect(
      find.semantics.byLabel('Reply'),
      isSemantics(label: 'Reply', isButton: true),
    );
    // Disposed here rather than in a tearDown: the framework checks for live
    // handles BEFORE tear-downs run.
    handle.dispose();
  });

  testWidgets('the three actions share one row and clear a 44pt target', (
    tester,
  ) async {
    await pump(tester, post(entry()));
    // Reply lives beside the heart now, not under the replies list: one row,
    // one interaction system. Its glyph carries no visible label (native pass,
    // 2026-08-31) — a bubble is unambiguous and the row reads as controls
    // rather than as a caption — so the name is spoken, not printed.
    expect(
      find.byWidgetPredicate(
        (w) => w is Semantics && w.properties.label == 'Reply',
      ),
      findsOneWidget,
    );
    expect(find.text('Log this too'), findsOneWidget);
    // Measured on the button itself, not on whatever it uses for its press
    // feedback: the target is the contract, the ink is an implementation
    // detail that has already changed once.
    final buttons = find.byType(FeedActionButton);
    expect(buttons, findsNWidgets(3));
    for (var i = 0; i < 3; i++) {
      expect(tester.getSize(buttons.at(i)).height, greaterThanOrEqualTo(44));
    }
    // ONE row: same top edge, left to right. The Wrap stacked all three one
    // per line while KalloPressable still grew to the width it was offered
    // (fixed 2026-09-08), which a height-only assertion could not see.
    final tops = [for (var i = 0; i < 3; i++) tester.getTopLeft(buttons.at(i))];
    expect(tops[1].dy, tops[0].dy);
    expect(tops[2].dy, tops[0].dy);
    expect(tops[1].dx, greaterThan(tops[0].dx));
    expect(tops[2].dx, greaterThan(tops[1].dx));
  });

  testWidgets('a post in the feed shows no replies under it', (tester) async {
    // Threads anatomy: the post plus ONE action row. Replies live on the
    // thread page, and the count on the reply glyph is what says so — the
    // card used to tease the newest two under the action row.
    await pump(
      tester,
      _StaticThread(
        state: SharedMealFeedState(
          entries: [
            entry(replies: [reply(body: 'Ngon quá!')], repliesTotal: 4),
          ],
          nextCursor: null,
        ),
      ),
    );
    expect(find.byType(FeedEntry), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(FeedEntry),
        matching: find.byType(ReplyRow),
      ),
      findsNothing,
    );
    expect(find.text('Ngon quá!'), findsNothing);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('a reply is plain text under its author', (tester) async {
    // The pill is gone (user reference, 2026-09-08): a reply body is set like
    // the post's meal text — same tier, same gap, same left edge — because the
    // card it sits on is already the surface.
    await pump(tester, ReplyRow(reply: reply(body: 'Ngon'), locale: 'en'));
    // No painted box AROUND THE BODY. Scoped to the body's own ancestry
    // rather than to the whole row, because the avatar disc beside it is
    // itself a Container with a gradient — "no decoration anywhere in
    // ReplyRow" would fail on the disc no matter how the body is drawn.
    expect(
      find.ancestor(
        of: find.text('Ngon'),
        matching: find.byWidgetPredicate(
          (w) => w is Container && w.decoration != null,
        ),
      ),
      findsNothing,
    );
    expect(tester.widget<Text>(find.text('Ngon')).style, dashBody());

    final name = tester.getRect(find.textContaining('linh'));
    final body = tester.getRect(find.text('Ngon'));
    expect(body.top - name.bottom, closeTo(kFeedTight, 0.5));
    expect(body.left, name.left);
  });

  testWidgets('a long unbroken word wraps inside the column', (tester) async {
    // A URL or a mashed-together word has no break opportunity, so nothing
    // wraps it for free: the body must stay inside the content column rather
    // than running out past the card edge.
    const long = 'aaaaaaaaaabbbbbbbbbbccccccccccddddddddddeeeeeeeeeeffffffffff';
    expect(long.length, 60);
    await pump(
      tester,
      SizedBox(
        width: 300,
        child: ReplyRow(reply: reply(body: long), locale: 'en'),
      ),
    );
    final text = tester.getSize(find.text(long));
    expect(text.width, lessThanOrEqualTo(300));
    // Wrapped, not clipped or overflowing: more than one line of body copy.
    expect(text.height, greaterThan(dashBody().fontSize! * 1.5));
  });

  testWidgets('the composition bar renders for a meal with macros', (
    tester,
  ) async {
    await pump(tester, post(entry()));
    expect(find.byType(CompositionBar), findsOneWidget);
    final size = tester.getSize(find.byType(CompositionBar));
    // The feed draws the bar at half the nutrition page's height; see the
    // weight knobs in `feed_entry.dart`.
    expect(size.height, 6);
    expect(size.width, greaterThan(100));
  });

  testWidgets('the composition bar fills the content column, not 0pt', (
    tester,
  ) async {
    // The bar is a Row of Expanded children, so its intrinsic width is zero: a
    // regression here shows up as a full-height gap where the bar should be,
    // not as a missing widget. Measure the width, never just the presence.
    await pump(
      tester,
      _StaticThread(
        state: SharedMealFeedState(entries: [entry()], nextCursor: null),
      ),
    );
    final bar = tester.getSize(find.byType(CompositionBar));
    final column = tester.getSize(find.text('Bún chả Hà Nội'));
    expect(bar.height, 6);
    expect(bar.width, greaterThan(100));
    // Bar and meal text are the same block now, so they share one column.
    expect(bar.width, column.width);

    // Circle's documented kcal placement (native pass, 2026-08-31): the figure
    // LEADS the legend row, with the macro grams trailing it. A post's title
    // line is already spoken for by the author and the time, so kcal cannot
    // sit at its right the way an own meal's does.
    final barLeft = tester.getTopLeft(find.byType(CompositionBar)).dx;
    final kcalLeft = tester.getTopLeft(find.text('540 kcal')).dx;
    expect(kcalLeft, closeTo(barLeft, 1));
    expect(
      tester.getTopLeft(find.text('P 38g')).dx,
      greaterThan(tester.getBottomRight(find.text('540 kcal')).dx),
    );
  });

  testWidgets('a day boundary starts a new card, not a rule', (tester) async {
    // Two posts today, one yesterday. Rules go between posts WITHIN a day's
    // card; the boundary itself is the gap between two cards, so it can never
    // pick up a stray hairline the way the old label-plus-rule layout did.
    final state = SharedMealFeedState(
      entries: [
        entry(shareId: 's1'),
        entry(shareId: 's2'),
        entry(
          shareId: 's3',
          sharedAt: DateTime.now().subtract(const Duration(days: 1)),
        ),
      ],
      nextCursor: null,
    );
    await pump(tester, _StaticThread(state: state));
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.byType(FeedDayGroup), findsNWidgets(2));
    // One separator in total: between today's two posts. Yesterday's single
    // post has none, and neither does the boundary.
    expect(
      find.byWidgetPredicate(
        (w) =>
            w is Container &&
            w.margin == const EdgeInsets.only(left: kContentRail),
      ),
      findsOneWidget,
    );
  });

  testWidgets('day labels and empty add-friend CTA render', (tester) async {
    final state = SharedMealFeedState(
      entries: [
        entry(),
        entry(sharedAt: DateTime.now().subtract(const Duration(days: 1))),
      ],
      nextCursor: null,
    );
    await pump(tester, _StaticThread(state: state));
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Yesterday'), findsOneWidget);
    await pump(
      tester,
      const _StaticThread(
        state: SharedMealFeedState(entries: [], nextCursor: null),
      ),
    );
    expect(find.text('No shared meals yet'), findsOneWidget);
    expect(find.text('Add friend'), findsOneWidget);
  });

  testWidgets('a post that leaves the feed takes its replies with it', (
    tester,
  ) async {
    // What the deleted "reply draft does not migrate" test was really
    // defending: state belonging to one post must never surface under
    // another. FeedEntry owns no state at all now, so the claim is just that
    // the removed post — and the reply count that was its own — is gone.
    final entryA = entry(
      rawInput: 'Meal A',
      replies: [reply(body: 'On A')],
      repliesTotal: 7,
    );
    final entryB = entry(mealId: 'm2', shareId: 's2', rawInput: 'Meal B');
    final entries = ValueNotifier<List<CircleFeedEntry>>([entryA, entryB]);
    addTearDown(entries.dispose);
    await pump(tester, _MutableThread(entries: entries));
    expect(find.text('7'), findsOneWidget);

    entries.value = [entryB];
    await tester.pump();

    expect(find.text('Meal A'), findsNothing);
    expect(find.text('Meal B'), findsOneWidget);
    expect(find.text('7'), findsNothing);
  });
}

class _FeedHost extends ConsumerWidget {
  const _FeedHost();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(sharedMealFeedProvider(null));
    return feed.when(
      data: (value) => FeedEntry(entry: value.entries.single, onReply: () {}),
      error: (_, __) => const Text('error'),
      loading: () => const CircularProgressIndicator(),
    );
  }
}

class _StaticThread extends StatelessWidget {
  const _StaticThread({required this.state});
  final SharedMealFeedState state;
  @override
  Widget build(BuildContext context) => ThreadFeed(
    feed: AsyncData(state),
    header: const SizedBox.shrink(),
    onRefresh: () async {},
    onRetry: () {},
    onAddFriend: () {},
  );
}

class _MutableThread extends StatelessWidget {
  const _MutableThread({required this.entries});
  final ValueNotifier<List<CircleFeedEntry>> entries;

  @override
  Widget build(BuildContext context) =>
      ValueListenableBuilder<List<CircleFeedEntry>>(
        valueListenable: entries,
        builder:
            (_, value, __) => _StaticThread(
              state: SharedMealFeedState(entries: value, nextCursor: null),
            ),
      );
}
