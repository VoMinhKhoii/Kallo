import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/view_switcher.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/circle_add_menu.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';

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

  Future<void> pump(
    WidgetTester tester, {
    required AsyncValue<List<ChatGroupIdentity>> groups,
    List<CircleFeedEntry> feed = const [],
    DateTime? marker,
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
                overrides: [
                  chatGroupsProvider.overrideWith((_) => groups.requireValue),
                  circleFeedProvider.overrideWith((_) => Stream.value(feed)),
                  friendsReadMarkerProvider.overrideWith(
                    (_) async => marker ?? DateTime.utc(2026),
                  ),
                ],
                child: MaterialApp(
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                  home: const Scaffold(body: ViewSwitcher()),
                ),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('switcher is hidden when there are no named groups', (
    tester,
  ) async {
    await pump(tester, groups: const AsyncData([]));
    expect(find.text('All'), findsNothing);
  });

  testWidgets('renders All and group pills and selects the group', (
    tester,
  ) async {
    await pump(tester, groups: AsyncData([group(unread: false)]));
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Weekend hikers'), findsOneWidget);
    await tester.tap(find.text('Weekend hikers'));
    await tester.pump();
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );
    expect(scope.read(circleSelectedViewProvider), 'g1');
  });

  // One scenario per test: re-pumping the same ProviderScope with different
  // overrides does not recompute already-resolved providers.
  testWidgets('unread dots shown when group unread and feed newer than marker', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: true)]),
      feed: [entry(DateTime.utc(2026, 7, 18))],
      marker: DateTime.utc(2026, 7, 17),
    );
    expect(find.byKey(const Key('circle-unread-dot')), findsNWidgets(2));
  });

  testWidgets('unread dots hidden when read and marker newer than feed', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      feed: [entry(DateTime.utc(2026, 7, 18))],
      marker: DateTime.utc(2026, 7, 19),
    );
    expect(find.byKey(const Key('circle-unread-dot')), findsNothing);
  });

  // The header's add control is an ANCHORED POPOVER (native pass,
  // 2026-08-31), not the Cupertino action sheet it replaced: the card hangs
  // off the button that opened it, so the eye never leaves the corner it
  // touched. Housed in this file rather than its own so the suite gains no
  // extra parallel isolate — `test/services/billing/entitlements_test.dart`
  // polls against 20-50ms of REAL time and misses its window under one more
  // concurrent test file. That fragility is its own to fix.
  Future<void> pumpMenu(WidgetTester tester) async {
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: const Scaffold(
              body: Align(
                alignment: Alignment.topRight,
                child: CircleAddMenu(),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('the add popover opens under the button with two grouped rows', (
    tester,
  ) async {
    await pumpMenu(tester);
    expect(find.byType(ListRow), findsNothing);

    final button = tester.getRect(find.byType(CircleAddMenu));
    await tester.tap(find.byType(CircleAddMenu));
    await tester.pumpAndSettle();

    expect(find.text('Add friend'), findsOneWidget);
    expect(find.text('Create group'), findsOneWidget);

    // 240pt wide, hanging BELOW the button and aligned to its right edge —
    // the whole point of an anchored menu over a bottom sheet.
    final row = tester.getRect(find.byType(ListRow).first);
    expect(row.width, 240 - 32); // less the card's 16pt side padding
    expect(row.top, greaterThan(button.bottom));
    expect(row.right, lessThanOrEqualTo(button.right));

    // Grouped-card metrics: 52pt rows, the whole row tappable.
    expect(row.height, greaterThanOrEqualTo(52));
    for (final widget in tester.widgetList<ListRow>(find.byType(ListRow))) {
      expect(widget.onTap, isNotNull);
    }
  });

  testWidgets('tapping the scrim dismisses the add popover', (tester) async {
    await pumpMenu(tester);
    await tester.tap(find.byType(CircleAddMenu));
    await tester.pumpAndSettle();
    expect(find.byType(ListRow), findsNWidgets(2));

    // Bottom-left is scrim, well clear of the card in the top-right corner.
    await tester.tapAt(const Offset(20, 500));
    await tester.pumpAndSettle();
    expect(find.byType(ListRow), findsNothing);
  });
}

ChatGroupIdentity group({required bool unread}) => ChatGroupIdentity(
  id: 'g1',
  kind: 'group',
  title: 'Weekend hikers',
  updatedAt: '2026-07-18T00:00:00Z',
  unread: unread,
);

CircleFeedEntry entry(DateTime sharedAt) => CircleFeedEntry(
  friend: const CircleProfile(userId: 'u2', handle: 'mai'),
  isSelf: false,
  meal: CircleFeedMeal(
    mealId: 'm1',
    shareId: 's1',
    rawInput: 'Phở',
    sharedAt: sharedAt.toIso8601String(),
  ),
);
