import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/features/circle/data/feed_providers.dart';
import 'package:nham_mobile/features/circle/widgets/feed_entry.dart';
import 'package:nham_mobile/features/circle/widgets/thread_feed.dart';
import 'package:nham_mobile/models/circle.dart';

import 'circle_feed_test_support.dart';
import 'l10n_test_loader.dart';

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

  CircleFeedEntry entry({
    bool self = false,
    double portion = 1,
    double? protein = 38,
    int repliesTotal = 0,
    List<ShareReply> replies = const [],
    ShareReactions reactions = const ShareReactions(),
    DateTime? sharedAt,
  }) => CircleFeedEntry(
    friend: const CircleProfile(
      userId: 'u2',
      handle: 'mai',
      displayName: 'Mai',
      avatarUrl: null,
    ),
    isSelf: self,
    meal: CircleFeedMeal(
      mealId: 'm1',
      shareId: 's1',
      rawInput: 'Bún chả Hà Nội',
      sharedAt: (sharedAt ?? DateTime.now()).toUtc().toIso8601String(),
      caloriesKcal: 540,
      proteinG: protein,
      carbohydrateG: protein == null ? null : 62,
      fatG: protein == null ? null : 14,
      portionFactor: portion,
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

  testWidgets('entry preserves diacritics and renders macros, kcal, and N/A', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry()));
    expect(find.text('Mai'), findsOneWidget);
    expect(find.text('Bún chả Hà Nội'), findsOneWidget);
    expect(find.textContaining('P: 38g'), findsOneWidget);
    expect(find.text('540 kcal'), findsOneWidget);

    await pump(tester, FeedEntry(entry: entry(protein: null)));
    expect(find.textContaining('P: N/A'), findsOneWidget);
  });

  testWidgets('portion badge only appears below a full portion', (
    tester,
  ) async {
    await pump(tester, FeedEntry(entry: entry(portion: 0.5)));
    expect(find.text('½ portion'), findsOneWidget);
    await pump(tester, FeedEntry(entry: entry()));
    expect(find.textContaining('portion'), findsNothing);
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
    await tester.tap(find.byIcon(LucideIcons.heart));
    await tester.pump();
    expect(find.text('3'), findsOneWidget);
    expect(tester.widget<Icon>(find.byIcon(LucideIcons.heart)).fill, 1);
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
    await tester.tap(find.byIcon(LucideIcons.heart));
    await tester.pump();
    expect(find.text('3'), findsOneWidget);
    response.completeError(ApiError('NOPE', 500, false, 'failed'));
    await tester.pumpAndSettle();
    expect(find.text('2'), findsOneWidget);
    expect(tester.widget<Icon>(find.byIcon(LucideIcons.heart)).fill, 0);
  });

  testWidgets('earlier replies line obeys the hidden reply count', (
    tester,
  ) async {
    final reply = ShareReply(
      id: 'r1',
      author: const CircleProfile(
        userId: 'u3',
        handle: 'linh',
        avatarUrl: null,
      ),
      isSelf: false,
      body: 'Ngon quá!',
      createdAt: DateTime.now(),
    );
    await pump(
      tester,
      FeedEntry(entry: entry(replies: [reply], repliesTotal: 3)),
    );
    expect(find.text('2 earlier replies'), findsOneWidget);
    await pump(
      tester,
      FeedEntry(entry: entry(replies: [reply], repliesTotal: 1)),
    );
    expect(find.textContaining('earlier replies'), findsNothing);
  });

  testWidgets('reply opens composer and empty blur closes it', (tester) async {
    await pump(tester, FeedEntry(entry: entry()));
    await tester.tap(find.text('Reply'));
    await tester.pump();
    expect(find.byKey(const Key('reply-composer')), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Reply'), findsNothing);
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pump();
    expect(find.byKey(const Key('reply-composer')), findsNothing);
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
}

class _FeedHost extends ConsumerWidget {
  const _FeedHost();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(sharedMealFeedProvider(null));
    return feed.when(
      data: (value) => FeedEntry(entry: value.entries.single),
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
    onRetry: () {},
    onAddFriend: () {},
  );
}
