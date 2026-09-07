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
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/reply_preview.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/composition_bar.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// The reply bubble around [body]: the nearest Container up from the text.
Finder pill(String body) =>
    find.ancestor(of: find.text(body), matching: find.byType(Container)).first;

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

  testWidgets(
    'entry preserves diacritics and renders macros, kcal, and a missing macro',
    (tester) async {
      await pump(tester, FeedEntry(entry: entry()));
      expect(find.textContaining('Mai'), findsOneWidget);
      expect(find.text('Bún chả Hà Nội'), findsOneWidget);
      expect(find.text('P 38g'), findsOneWidget);
      expect(find.textContaining('540 kcal'), findsOneWidget);

      // A missing macro reads as an em dash, not the long "no data" string:
      // three of those in one row wraps the line and buries the known figures.
      await pump(tester, FeedEntry(entry: entry(protein: null)));
      expect(find.text('P —'), findsOneWidget);
    },
  );

  testWidgets('portion badge only appears below a full portion', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry(portion: 0.5)));
    expect(find.text('½ portion'), findsOneWidget);
    await pump(tester, FeedEntry(entry: entry()));
    expect(find.textContaining('portion'), findsNothing);
  });

  testWidgets('the logged clock time shows, and hides for a backfill', (
    tester,
  ) async {
    // A fixed local instant, so the expectation does not drift with the clock
    // or the machine's zone.
    final loggedAt = DateTime(2026, 8, 13, 15, 2);
    final shown = formatLoggedTime(loggedAt, locale: 'en');

    await pump(tester, FeedEntry(entry: entry(sharedAt: loggedAt)));
    expect(find.textContaining(shown), findsOneWidget);

    // A backfilled share carries a sharedAt of "now", so its clock time would
    // describe when the meal was typed up rather than when it was eaten.
    await pump(
      tester,
      FeedEntry(entry: entry(sharedAt: loggedAt, isBackfilled: true)),
    );
    expect(find.textContaining(shown), findsNothing);
  });

  testWidgets('Log this too is hidden for self and shown for others', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry(self: true)));
    expect(find.text('Log this too'), findsNothing);
    await pump(tester, FeedEntry(entry: entry()));
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
    expect(tester.widget<Icon>(find.byIcon(LucideIcons.heart300)).fill, 1);
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
    expect(tester.widget<Icon>(find.byIcon(LucideIcons.heart300)).fill, 0);
  });

  testWidgets('the card teases the newest replies and links out for the rest', (
    tester,
  ) async {
    // The card is a teaser now that replies have their own page: it shows the
    // newest two and sends you to the thread for the count. The "N earlier
    // replies" line moved to the thread, where it is honest — the API only
    // ever ships 12 per share.
    final replies = [
      for (var i = 1; i <= 3; i++) reply(id: 'r$i', body: 'Reply $i'),
    ];
    await pump(
      tester,
      ReplyPreview(
        entry: entry(replies: replies, repliesTotal: 9),
        scope: null,
      ),
    );
    expect(find.text('Reply 1'), findsNothing);
    expect(find.text('Reply 2'), findsOneWidget);
    expect(find.text('Reply 3'), findsOneWidget);
    expect(find.text('View all 9 replies'), findsOneWidget);

    // Nothing hidden: no link, because there is nowhere further to go.
    await pump(
      tester,
      ReplyPreview(
        entry: entry(replies: [replies.first], repliesTotal: 1),
        scope: null,
      ),
    );
    expect(find.textContaining('View all'), findsNothing);
  });

  testWidgets('a reply sits in a pill that hugs its own text', (tester) async {
    // The bubble is shrink-wrapped by an Align, so a short reply must be
    // narrower than the column it sits in. A regression to a full-bleed block
    // shows up as equal widths, not as a missing widget.
    await pump(
      tester,
      ReplyPreview(
        entry: entry(replies: [reply(body: 'Ngon')], repliesTotal: 1),
        scope: null,
      ),
    );
    final bubble = tester.getSize(pill('Ngon'));
    final preview = tester.getSize(find.byType(ReplyPreview));
    expect(bubble.width, lessThan(preview.width));
    // The author stays OUTSIDE the pill — identity above, body inside.
    expect(
      tester.getBottomRight(find.textContaining('linh')).dy,
      lessThanOrEqualTo(tester.getTopLeft(pill('Ngon')).dy),
    );
  });

  testWidgets('the three actions share one row and clear a 44pt target', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry()));
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
  });

  testWidgets('a long unbroken word stays inside the reply pill', (
    tester,
  ) async {
    // A URL or a mashed-together word has no break opportunity, so nothing
    // wraps it for free: the pill must still be bounded by the column it sits
    // in rather than running out past the card edge.
    const long = 'aaaaaaaaaabbbbbbbbbbccccccccccddddddddddeeeeeeeeeeffffffffff';
    expect(long.length, 60);
    await pump(
      tester,
      ReplyPreview(
        entry: entry(replies: [reply(body: long)], repliesTotal: 1),
        scope: null,
      ),
    );
    final bubble = tester.getRect(pill(long));
    final preview = tester.getRect(find.byType(ReplyPreview));
    expect(bubble.width, lessThanOrEqualTo(preview.width));
    expect(bubble.right, lessThanOrEqualTo(preview.right));
  });

  testWidgets('a post with no replies draws no reply block at all', (
    tester,
  ) async {
    await pump(tester, ReplyPreview(entry: entry(), scope: null));
    // Otherwise the post carries an empty padded box under its action row and
    // reads bottom-heavy against the next hairline.
    expect(tester.getSize(find.byType(ReplyPreview)).height, 0);
  });

  testWidgets('the composition bar renders for a meal with macros', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry()));
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
    // the removed post and its preview are gone.
    final entryA = entry(rawInput: 'Meal A', replies: [reply(body: 'On A')]);
    final entryB = entry(mealId: 'm2', shareId: 's2', rawInput: 'Meal B');
    final entries = ValueNotifier<List<CircleFeedEntry>>([entryA, entryB]);
    addTearDown(entries.dispose);
    await pump(tester, _MutableThread(entries: entries));
    expect(find.text('On A'), findsOneWidget);

    entries.value = [entryB];
    await tester.pump();

    expect(find.text('Meal A'), findsNothing);
    expect(find.text('Meal B'), findsOneWidget);
    expect(find.text('On A'), findsNothing);
  });
}

class _FeedHost extends ConsumerWidget {
  const _FeedHost();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(sharedMealFeedProvider(null));
    return feed.when(
      data:
          (value) => FeedEntry(
            entry: value.entries.single,
            footer: ReplyPreview(entry: value.entries.single, scope: null),
          ),
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
