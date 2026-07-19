import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/circle/data/chat_group_providers.dart';
import 'package:nham_mobile/features/circle/data/circle_providers.dart';
import 'package:nham_mobile/features/circle/data/feed_providers.dart';
import 'package:nham_mobile/features/circle/widgets/view_switcher.dart';
import 'package:nham_mobile/models/chat_group.dart';
import 'package:nham_mobile/models/circle.dart';

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
