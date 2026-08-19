import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/widgets/groups/create_group_sheet.dart';
import 'package:kallo_mobile/features/circle/widgets/groups/group_info_sheet.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/view_switcher.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

final _groupsRefreshProvider =
    StateProvider<AsyncValue<List<ChatGroupIdentity>>>(
      (_) => AsyncData([ChatGroupIdentity.fromJson(_groupJson())]),
    );

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
    WidgetTester tester,
    Widget child, {
    required List<Override> overrides,
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

  testWidgets('retry pill refetches chat groups after an error', (
    tester,
  ) async {
    var calls = 0;
    final api = FakeApiClient((request) {
      if (request.path.startsWith('/api/v1/chat-groups?')) {
        calls++;
        if (calls == 1) {
          throw ApiError('NOPE', 400, false, 'failed');
        }
        return {
          'groups': [_groupJson()],
        };
      }
      return unexpectedRequest(request);
    });
    await pump(
      tester,
      const ViewSwitcher(),
      overrides: [
        apiClientProvider.overrideWithValue(api),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith((_) async => DateTime.utc(2026)),
      ],
    );

    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(calls, 2);
    expect(find.text('Weekend hikers'), findsOneWidget);
  });

  testWidgets('missing selected group resets only after a data refresh', (
    tester,
  ) async {
    await pump(
      tester,
      const ViewSwitcher(),
      overrides: [
        circleSelectedViewProvider.overrideWith((_) => 'g1'),
        chatGroupsProvider.overrideWith((ref) {
          final groups = ref.watch(_groupsRefreshProvider);
          return groups.when(
            data: (value) => value,
            error: Error.throwWithStackTrace,
            loading: () => const <ChatGroupIdentity>[],
          );
        }),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith((_) async => DateTime.utc(2026)),
      ],
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );

    container.read(_groupsRefreshProvider.notifier).state = const AsyncData([]);
    await tester.pumpAndSettle();

    expect(container.read(circleSelectedViewProvider), isNull);
  });

  testWidgets('group refresh error preserves the selected group', (
    tester,
  ) async {
    await pump(
      tester,
      const ViewSwitcher(),
      overrides: [
        circleSelectedViewProvider.overrideWith((_) => 'g1'),
        chatGroupsProvider.overrideWith((ref) {
          final groups = ref.watch(_groupsRefreshProvider);
          return groups.when(
            data: (value) => value,
            error: Error.throwWithStackTrace,
            loading: () => const <ChatGroupIdentity>[],
          );
        }),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith((_) async => DateTime.utc(2026)),
      ],
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );

    container.read(_groupsRefreshProvider.notifier).state = AsyncError(
      StateError('refresh failed'),
      StackTrace.current,
    );
    await tester.pumpAndSettle();

    expect(container.read(circleSelectedViewProvider), 'g1');
  });

  testWidgets('create group gates submit and updates selected count', (
    tester,
  ) async {
    await pump(
      tester,
      const CreateGroupSheet(),
      overrides: [
        circleFriendsProvider.overrideWith((_) async => [_friend()]),
      ],
    );
    FilledButton submit() => tester.widget(find.byType(FilledButton));

    expect(submit().onPressed, isNull);
    await tester.enterText(find.byType(TextField).first, 'Dinner crew');
    await tester.pump();
    expect(submit().onPressed, isNull);
    expect(find.text('0 selected'), findsOneWidget);
    await tester.tap(find.text('Mai'));
    await tester.pump();

    expect(find.text('1 selected'), findsOneWidget);
    expect(submit().onPressed, isNotNull);
  });

  testWidgets('create group selects the returned group id', (tester) async {
    final api = FakeApiClient((request) {
      if (request.method == 'POST' && request.path == '/api/v1/chat-groups') {
        return {
          'group': {'id': 'new-group'},
        };
      }
      return unexpectedRequest(request);
    });
    await pump(
      tester,
      const CreateGroupSheet(),
      overrides: [
        apiClientProvider.overrideWithValue(api),
        circleFriendsProvider.overrideWith((_) async => [_friend()]),
      ],
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(CreateGroupSheet)),
    );
    await tester.enterText(find.byType(TextField).first, 'Dinner crew');
    await tester.tap(find.text('Mai'));
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Create group'));
    await tester.pumpAndSettle();

    expect(container.read(circleSelectedViewProvider), 'new-group');
    expect(api.requests.single.body, {
      'name': 'Dinner crew',
      'memberUserIds': ['u2'],
    });
  });

  testWidgets('rename affordance is visible only to the owner', (tester) async {
    await pump(
      tester,
      const GroupInfoSheet(groupId: 'g1'),
      overrides: [
        chatGroupDetailProvider(
          'g1',
        ).overrideWith((_) async => _detail(role: 'owner')),
        circleFriendsProvider.overrideWith((_) async => const []),
      ],
    );
    expect(find.byTooltip('Rename group'), findsOneWidget);
  });

  testWidgets('rename affordance is hidden from a member', (tester) async {
    await pump(
      tester,
      const GroupInfoSheet(groupId: 'g1'),
      overrides: [
        chatGroupDetailProvider(
          'g1',
        ).overrideWith((_) async => _detail(role: 'member')),
        circleFriendsProvider.overrideWith((_) async => const []),
      ],
    );
    expect(find.byTooltip('Rename group'), findsNothing);
  });

  testWidgets('remove-member confirmation sends DELETE', (tester) async {
    final api = FakeApiClient((request) => <String, dynamic>{});
    await pump(
      tester,
      const GroupInfoSheet(groupId: 'g1'),
      overrides: [
        apiClientProvider.overrideWithValue(api),
        chatGroupDetailProvider(
          'g1',
        ).overrideWith((_) async => _detail(role: 'owner')),
        circleFriendsProvider.overrideWith((_) async => const []),
      ],
    );
    await tester.tap(find.byTooltip('Remove Mai'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Remove'));
    await tester.pumpAndSettle();

    expect(api.requests.single.method, 'DELETE');
    expect(api.requests.single.path, '/api/v1/chat-groups/g1/members/u2');
  });

  testWidgets('leave confirmation calls DELETE and resets selection', (
    tester,
  ) async {
    final api = FakeApiClient((request) => <String, dynamic>{});
    await pump(
      tester,
      const GroupInfoSheet(groupId: 'g1'),
      overrides: [
        apiClientProvider.overrideWithValue(api),
        circleSelectedViewProvider.overrideWith((_) => 'g1'),
        chatGroupDetailProvider(
          'g1',
        ).overrideWith((_) async => _detail(role: 'member')),
        circleFriendsProvider.overrideWith((_) async => const []),
      ],
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GroupInfoSheet)),
    );
    await tester.tap(find.widgetWithText(TextButton, 'Leave group'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Leave group').last);
    await tester.pumpAndSettle();

    expect(api.requests.single.method, 'DELETE');
    expect(api.requests.single.path, '/api/v1/chat-groups/g1/leave');
    expect(container.read(circleSelectedViewProvider), isNull);
  });

  testWidgets('group feed empty state uses groupNoActivity', (tester) async {
    await pump(
      tester,
      ThreadFeed(
        scope: 'g1',
        feed: const AsyncData(
          SharedMealFeedState(entries: [], nextCursor: null),
        ),
        header: const SizedBox.shrink(),
        onRetry: () {},
        onAddFriend: () {},
        emptyTitleKey: 'groups.page.groupNoActivity',
        emptyDescriptionKey: 'groups.page.groupNoActivity',
        emptyNamedArgs: const {'name': 'Weekend hikers'},
        showAddFriend: false,
      ),
      overrides: const [],
    );
    expect(
      find.text('Nothing has been shared in Weekend hikers yet.'),
      findsNWidgets(2),
    );
  });
}

Map<String, dynamic> _groupJson() => {
  'id': 'g1',
  'kind': 'group',
  'title': 'Weekend hikers',
  'updatedAt': '2026-07-18T00:00:00Z',
  'unread': false,
};

CircleMember _friend() => const CircleMember(
  friendshipId: 'f1',
  status: 'accepted',
  profile: CircleProfile(
    userId: 'u2',
    handle: 'mai',
    displayName: 'Mai',
    avatarUrl: null,
  ),
);

ChatGroupDetail _detail({required String role}) => ChatGroupDetail(
  id: 'g1',
  kind: 'group',
  name: 'Weekend hikers',
  myRole: role,
  members: const [
    ChatGroupMember(userId: 'owner', handle: 'me', role: 'owner'),
    ChatGroupMember(
      userId: 'u2',
      handle: 'mai',
      displayName: 'Mai',
      role: 'member',
      avatarUrl: null,
    ),
  ],
);
