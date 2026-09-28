import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/screens/circle_manage_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/manage/more_button.dart';
import 'package:kallo_mobile/features/circle/widgets/states/friend_list_skeleton.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_small_button.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/feature_lock.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';

import '../circle_feed_test_support.dart';

const _friendsPath = '/api/v1/groups/friends';
const _blockedPath = '/api/v1/groups/friends/blocked';

Map<String, dynamic> _member(String id, String name, {String? status}) => {
  'friendshipId': 'f-$id',
  'status': status ?? 'accepted',
  'profile': {'userId': id, 'handle': id, 'displayName': name},
};

Map<String, dynamic> _group(String id, String title, {String kind = 'group'}) =>
    {
      'id': id,
      'kind': kind,
      'title': title,
      'updatedAt': '2026-09-28T00:00:00.000Z',
    };

/// A fake backend for "Edit circle": [friends], [groups] and [blocked] are
/// what the three lists read; every POST/DELETE succeeds. Each group's detail
/// says the viewer is [myRole], with other members unless [aloneInGroup].
FakeApiClient _api({
  List<Map<String, dynamic>> friends = const [],
  List<Map<String, dynamic>> groups = const [],
  List<Map<String, dynamic>> blocked = const [],
  bool friendsFail = false,
  Future<void>? friendsGate,
  bool blockedFail = false,
  String myRole = 'member',
  bool aloneInGroup = false,
  bool groupDetailFail = false,
  Future<void>? groupDetailGate,
  Future<void>? writeGate,
  bool writeFail = false,
  Future<void>? blockedRefetchGate,
}) {
  var blockedFetches = 0;
  // Like the server: once blocked, a person leaves the friends list.
  final blockedIds = <String>{};
  return FakeApiClient((request) async {
    final path = request.path;
    if (request.method != 'GET' && writeGate != null) await writeGate;
    if (request.method != 'GET' && writeFail) throw Exception('offline');
    if (request.method == 'GET') {
      if (path == _friendsPath) {
        if (friendsFail) throw Exception('offline');
        if (friendsGate != null) await friendsGate;
        return {
          'circle': [
            for (final f in friends)
              if (!blockedIds.contains((f['profile'] as Map)['userId'])) f,
          ],
        };
      }
      if (path == _blockedPath) {
        if (blockedFail) throw Exception('offline');
        // With a refetch gate, every fetch after the first is the refresh an
        // unblock starts: it waits on the gate, then comes back empty.
        if (blockedFetches++ > 0 && blockedRefetchGate != null) {
          await blockedRefetchGate;
          return {'blocked': const <Map<String, dynamic>>[]};
        }
        return {'blocked': blocked};
      }
      if (path.startsWith('/api/v1/chat-groups?')) return {'groups': groups};
      if (path.startsWith('/api/v1/chat-groups/')) {
        if (groupDetailFail) throw Exception('offline');
        if (groupDetailGate != null) await groupDetailGate;
        final id = path.split('/').last;
        return {
          'group': {
            'id': id,
            'kind': 'group',
            'name': id,
            'myRole': myRole,
            'members': [
              {'userId': 'me', 'handle': 'me', 'role': myRole},
              if (!aloneInGroup)
                {
                  'userId': 'u9',
                  'handle': 'u9',
                  'role': myRole == 'owner' ? 'member' : 'owner',
                },
            ],
          },
        };
      }
      if (path == '/api/v1/groups/profile') {
        return {
          'profile': {
            'userId': 'me',
            'handle': 'me',
            'displayName': 'vmkhoiii',
          },
        };
      }
    }
    if (path == '/api/v1/groups/friends/block') {
      blockedIds.add((request.body! as Map)['targetUserId'] as String);
    }
    if (path == '/api/v1/reports') return {'id': 'report-1'};
    return <String, dynamic>{};
  });
}

Future<void> _pump(
  WidgetTester tester,
  FakeApiClient api, {
  CircleManageTab tab = CircleManageTab.friends,
}) => pumpCircleScreen(
  tester,
  CircleManageScreen(parentTitle: 'Settings', initialTab: tab),
  api: api,
  size: const Size(390, 844),
);

/// The row's `⋯` for [name].
Finder _more(String name) =>
    find.byWidgetPredicate((w) => w is MoreButton && w.name == name);

/// Whether [name]'s `⋯` still responds. The fake keeps answering with the
/// same lists, so a row whose person or group is gone stays on screen — the
/// state a slow refetch leaves the real page in.
bool _moreOn(WidgetTester tester, String name) =>
    tester.widget<MoreButton>(_more(name)).onPressed != null;

Iterable<Request> _writes(FakeApiClient api) =>
    api.requests.where((r) => r.method != 'GET');

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

  group('Friends tab', () {
    testWidgets('lists accepted friends only, each with a quiet ⋯', (
      tester,
    ) async {
      await _pump(
        tester,
        _api(
          friends: [
            _member('u1', 'Linh'),
            _member('u2', 'Pending Pat', status: 'pending'),
          ],
        ),
      );

      expect(find.text('Linh'), findsOneWidget);
      expect(find.text('Pending Pat'), findsNothing);
      expect(_more('Linh'), findsOneWidget);
      // Nothing red, nothing labelled Block / Remove, on the page itself.
      expect(find.text('Block'), findsNothing);
      expect(find.text('Remove from circle'), findsNothing);
    });

    testWidgets('⋯ → Block asks first, then blocks that person', (
      tester,
    ) async {
      final api = _api(friends: [_member('u1', 'Linh')]);
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      expect(find.text('Report'), findsOneWidget);
      expect(find.text('Remove from circle'), findsOneWidget);

      await tester.tap(find.text('Block'));
      await tester.pumpAndSettle();
      expect(find.text('Block Linh?'), findsOneWidget);
      expect(_writes(api), isEmpty, reason: 'nothing happens before confirm');

      await tester.tap(find.text('Block').last);
      await tester.pumpAndSettle();
      final write = _writes(api).single;
      expect(write.path, '/api/v1/groups/friends/block');
      expect(write.body, {'targetUserId': 'u1'});
      expect(_more('Linh'), findsNothing, reason: 'blocked: the row is gone');
    });

    testWidgets('the ⋯ is off while a block is in flight', (tester) async {
      final post = Completer<void>();
      final api = _api(
        friends: [_member('u1', 'Linh')],
        writeGate: post.future,
      );
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block').last);
      await tester.pumpAndSettle();

      // The confirm is gone and the POST hangs: no second flow can start.
      expect(_moreOn(tester, 'Linh'), isFalse);
      post.complete();
      await tester.pumpAndSettle();
      expect(_writes(api), hasLength(1));
    });

    testWidgets('a failed block turns the ⋯ back on', (tester) async {
      final api = _api(friends: [_member('u1', 'Linh')], writeFail: true);
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block').last);
      await tester.pumpAndSettle();

      expect(find.text("Couldn't block Linh. Try again."), findsOneWidget);
      expect(_moreOn(tester, 'Linh'), isTrue);
    });

    testWidgets('⋯ → Report sends the reason, then offers the block', (
      tester,
    ) async {
      final api = _api(friends: [_member('u1', 'Linh')]);
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report'));
      await tester.pumpAndSettle();
      expect(find.text('Why are you reporting this?'), findsOneWidget);

      await tester.tap(find.text('Harassment or bullying'));
      await tester.pumpAndSettle();
      final report = _writes(api).single;
      expect(report.path, '/api/v1/reports');
      expect(report.body, {
        'targetKind': 'profile',
        'targetId': 'u1',
        'reason': 'harassment',
      });
      expect(find.text('Thanks for letting us know'), findsOneWidget);
      expect(find.text('Block Linh'), findsOneWidget);

      // "Done" closes it without blocking, and the friend stays a friend.
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      expect(_writes(api).length, 1);
      expect(_moreOn(tester, 'Linh'), isTrue);
    });

    testWidgets('blocking from the report thank-you turns the row off', (
      tester,
    ) async {
      final api = _api(friends: [_member('u1', 'Linh')]);
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Harassment or bullying'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Block Linh'));
      await tester.pumpAndSettle();

      expect(_writes(api).last.path, '/api/v1/groups/friends/block');
      expect(_more('Linh'), findsNothing);
    });

    testWidgets('⋯ → Remove from circle confirms, then removes', (
      tester,
    ) async {
      final api = _api(friends: [_member('u1', 'Linh')]);
      await _pump(tester, api);

      await tester.tap(_more('Linh'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove from circle'));
      await tester.pumpAndSettle();
      expect(find.text('Remove Linh?'), findsOneWidget);
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();

      final write = _writes(api).single;
      expect(write.method, 'DELETE');
      expect(write.path, '/api/v1/groups/friends/remove');
      expect(write.body, {'targetUserId': 'u1'});
      expect(_moreOn(tester, 'Linh'), isFalse, reason: 'removed: row is off');
    });

    testWidgets('no friends: the capybara and "Add friend"', (tester) async {
      await _pump(tester, _api());

      expect(find.byType(KalloSurfaceState), findsOneWidget);
      expect(find.text('No friends yet'), findsOneWidget);
      expect(find.text('Add friend'), findsOneWidget);
    });

    testWidgets('a failed list is an error with a retry, not "no friends"', (
      tester,
    ) async {
      await _pump(tester, _api(friendsFail: true));

      expect(find.text("Couldn't load your circle"), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.text('No friends yet'), findsNothing);
    });

    testWidgets('"Blocked (n)" shows only once someone is blocked', (
      tester,
    ) async {
      await _pump(tester, _api(friends: [_member('u1', 'Linh')]));
      expect(find.textContaining('Blocked ('), findsNothing);
    });

    testWidgets('a failed blocked count keeps the way to the blocked list', (
      tester,
    ) async {
      await _pump(
        tester,
        _api(friends: [_member('u1', 'Linh')], blockedFail: true),
      );

      // No count to show, but the row stays: it is the only way to unblock.
      await tester.tap(find.text('Blocked'));
      await tester.pumpAndSettle();
      expect(find.text("Couldn't load who you've blocked"), findsOneWidget);
    });

    testWidgets('a failed friends fetch still leaves the way to unblock', (
      tester,
    ) async {
      await _pump(
        tester,
        _api(
          friendsFail: true,
          blocked: [
            {
              'profile': {'userId': 'b1', 'handle': 'b1', 'displayName': 'Duy'},
              'blockedAt': '2026-09-20T00:00:00.000Z',
            },
          ],
        ),
      );

      expect(find.text("Couldn't load your circle"), findsOneWidget);
      await tester.tap(find.text('Blocked (1)'));
      await tester.pumpAndSettle();
      expect(find.text('Duy'), findsOneWidget);
    });

    testWidgets('friends still loading leaves the way to unblock', (
      tester,
    ) async {
      // The friends request hangs; the blocked one has already answered.
      final gate = Completer<void>();
      await pumpCircleScreen(
        tester,
        const CircleManageScreen(parentTitle: 'Settings'),
        api: _api(
          friendsGate: gate.future,
          blocked: [
            {
              'profile': {'userId': 'b1', 'handle': 'b1', 'displayName': 'Duy'},
              'blockedAt': '2026-09-20T00:00:00.000Z',
            },
          ],
        ),
        size: const Size(390, 844),
        settle: false,
      );
      // The skeleton pulses forever, so step the clock instead of settling.
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(FriendListSkeleton), findsOneWidget);
      await tester.tap(find.text('Blocked (1)'));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 200));
      }
      expect(find.text('Duy'), findsOneWidget);

      gate.complete();
      await tester.pump(const Duration(milliseconds: 100));
    });

    testWidgets('the blocked list unblocks after a confirm', (tester) async {
      final api = _api(
        friends: [_member('u1', 'Linh')],
        blocked: [
          {
            'profile': {'userId': 'b1', 'handle': 'b1', 'displayName': 'Duy'},
            'blockedAt': '2026-09-20T00:00:00.000Z',
          },
        ],
      );
      await _pump(tester, api);

      await tester.tap(find.text('Blocked (1)'));
      await tester.pumpAndSettle();
      expect(find.text('Duy'), findsOneWidget);

      await tester.tap(find.text('Unblock'));
      await tester.pumpAndSettle();
      expect(find.text('Unblock Duy?'), findsOneWidget);
      await tester.tap(find.text('Unblock').last);
      await tester.pumpAndSettle();

      final write = _writes(api).single;
      expect(write.path, '/api/v1/groups/friends/unblock');
      expect(write.body, {'targetUserId': 'b1'});
    });

    testWidgets('Unblock stays off until the row leaves the list', (
      tester,
    ) async {
      final post = Completer<void>();
      final refetch = Completer<void>();
      final api = _api(
        writeGate: post.future,
        blockedRefetchGate: refetch.future,
        blocked: [
          {
            'profile': {'userId': 'b1', 'handle': 'b1', 'displayName': 'Duy'},
            'blockedAt': '2026-09-20T00:00:00.000Z',
          },
        ],
      );
      await _pump(tester, api);
      await tester.tap(find.text('Blocked (1)'));
      await tester.pumpAndSettle();

      // Cancelling the confirm leaves the button on.
      await tester.tap(find.text('Unblock'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Unblock'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Unblock').last);
      await tester.pumpAndSettle();
      expect(_writes(api), hasLength(1));

      Future<void> tapAgain() async {
        await tester.tap(find.text('Unblock'), warnIfMissed: false);
        await tester.pumpAndSettle();
        expect(find.text('Unblock Duy?'), findsNothing);
      }

      // The POST hangs: the row is still here, and a tap starts nothing.
      await tapAgain();
      // The POST lands and the list refetch hangs: the stale row is still
      // here, and still off.
      post.complete();
      await tester.pumpAndSettle();
      expect(find.text('Duy'), findsOneWidget);
      await tapAgain();

      refetch.complete();
      await tester.pumpAndSettle();
      expect(find.text('Duy'), findsNothing);
      expect(_writes(api), hasLength(1));
    });
  });

  group('Circle tab', () {
    testWidgets('lists named groups (not direct chats) with Go to circle', (
      tester,
    ) async {
      await _pump(
        tester,
        _api(
          groups: [
            _group('g1', 'Team lunch'),
            _group('d1', 'Linh', kind: 'direct'),
          ],
        ),
        tab: CircleManageTab.circle,
      );

      expect(find.text('Team lunch'), findsOneWidget);
      expect(find.text('Go to circle'), findsOneWidget);
      expect(_more('Linh'), findsNothing);
    });

    testWidgets('⋯ → Report group reports the group, with no block offer', (
      tester,
    ) async {
      final api = _api(groups: [_group('g1', 'Team lunch')]);
      await _pump(tester, api, tab: CircleManageTab.circle);

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report group'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Spam'));
      await tester.pumpAndSettle();

      expect(_writes(api).single.body, {
        'targetKind': 'chat_group',
        'targetId': 'g1',
        'reason': 'spam',
      });
      expect(find.text('Thanks for letting us know'), findsNothing);
    });

    testWidgets('the owner of a group with members is told why, not offered '
        'what the server refuses', (tester) async {
      // The server refuses both: a report resolves to the creator, and an
      // owner cannot leave while others remain.
      await _pump(
        tester,
        _api(groups: [_group('g1', 'Team lunch')], myRole: 'owner'),
        tab: CircleManageTab.circle,
      );

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      expect(find.text('Report group'), findsNothing);
      expect(find.text('Leave group'), findsNothing);
      expect(
        find.text(
          'You own this group — you can leave once everyone else has left.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('tapping ⋯ again while the role loads opens one sheet', (
      tester,
    ) async {
      final gate = Completer<void>();
      await _pump(
        tester,
        _api(
          groups: [_group('g1', 'Team lunch')],
          groupDetailGate: gate.future,
        ),
        tab: CircleManageTab.circle,
      );

      await tester.tap(_more('Team lunch'));
      await tester.pump();
      await tester.tap(_more('Team lunch'));
      await tester.pump();
      gate.complete();
      await tester.pumpAndSettle();

      expect(find.text('Report group'), findsOneWidget);
    });

    testWidgets('rendering the list fetches no group detail', (tester) async {
      // N groups must not fan out into N detail requests: the role is
      // loaded when a `⋯` is tapped, for that group only.
      final api = _api(
        groups: [_group('g1', 'Team lunch'), _group('g2', 'Family')],
      );
      await _pump(tester, api, tab: CircleManageTab.circle);

      bool detailFetched(String id) => api.requests.any(
        (r) => r.method == 'GET' && r.path == '/api/v1/chat-groups/$id',
      );
      expect(detailFetched('g1'), isFalse);
      expect(detailFetched('g2'), isFalse);

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      expect(detailFetched('g1'), isTrue);
      expect(detailFetched('g2'), isFalse);
    });

    testWidgets('an unknown role offers nothing: a failed load is a toast', (
      tester,
    ) async {
      // The role never loads, so the menu must not guess: an owner would be
      // offered what the server refuses.
      final api = _api(
        groups: [_group('g1', 'Team lunch')],
        groupDetailFail: true,
      );
      await _pump(tester, api, tab: CircleManageTab.circle);

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      expect(find.text('Report group'), findsNothing);
      expect(find.text('Leave group'), findsNothing);
      expect(find.text("Couldn't load this group. Try again."), findsOneWidget);
    });

    testWidgets('an owner alone in the group can leave, not report', (
      tester,
    ) async {
      await _pump(
        tester,
        _api(
          groups: [_group('g1', 'Team lunch')],
          myRole: 'owner',
          aloneInGroup: true,
        ),
        tab: CircleManageTab.circle,
      );

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      expect(find.text('Leave group'), findsOneWidget);
      expect(find.text('Report group'), findsNothing);
    });

    testWidgets('a group just left is off until the list drops it', (
      tester,
    ) async {
      final api = _api(groups: [_group('g1', 'Team lunch')]);
      await _pump(tester, api, tab: CircleManageTab.circle);

      await tester.tap(_more('Team lunch'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Leave group'));
      await tester.pumpAndSettle();
      expect(find.text('Leave this group?'), findsOneWidget);
      await tester.tap(find.text('Leave group').last);
      await tester.pumpAndSettle();

      expect(_writes(api).single.method, 'DELETE');
      expect(_moreOn(tester, 'Team lunch'), isFalse);
      final goTo = tester.widget<KalloSmallButton>(
        find.widgetWithText(KalloSmallButton, 'Go to circle'),
      );
      expect(goTo.onPressed, isNull);
    });

    testWidgets('no groups: the capybara in a box and "Create group"', (
      tester,
    ) async {
      await _pump(tester, _api(), tab: CircleManageTab.circle);

      expect(find.text('No groups yet'), findsOneWidget);
      expect(find.text('Create group'), findsOneWidget);
    });

    testWidgets('a free plan\'s "Create group" opens the paywall', (
      tester,
    ) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder:
                (_, __) => const CircleManageScreen(
                  parentTitle: 'Settings',
                  initialTab: CircleManageTab.circle,
                ),
          ),
          GoRoute(path: '/paywall', builder: (_, __) => const Text('PAYWALL')),
        ],
      );
      await pumpCircleRouter(
        tester,
        router,
        api: _api(),
        overrides: [
          premiumLockProvider(
            PremiumFeature.unlimitedCircle,
          ).overrideWithValue(true),
        ],
      );

      await tester.tap(find.text('Create group'));
      await tester.pumpAndSettle();

      expect(find.text('PAYWALL'), findsOneWidget);
    });

    testWidgets('Go to circle opens the Circle tab on that group', (
      tester,
    ) async {
      final api = _api(groups: [_group('g1', 'Team lunch')]);
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder:
                (_, __) => const CircleManageScreen(
                  parentTitle: 'Settings',
                  initialTab: CircleManageTab.circle,
                ),
          ),
          GoRoute(path: '/circle', builder: (_, __) => const Text('CIRCLE')),
        ],
      );
      await pumpCircleRouter(tester, router, api: api);

      // Read before the tap: the tap navigates away and unmounts the screen.
      final container = ProviderScope.containerOf(
        tester.element(find.byType(CircleManageScreen)),
      );
      await tester.tap(find.text('Go to circle'));
      await tester.pumpAndSettle();

      expect(find.text('CIRCLE'), findsOneWidget);
      expect(container.read(circleSelectedViewProvider), 'g1');
    });
  });

  testWidgets('the tabs are Friends and Circle, underline style', (
    tester,
  ) async {
    await _pump(tester, _api());
    expect(find.text(tr('groups.manage.tabFriends')), findsOneWidget);
    expect(find.text(tr('groups.manage.tabCircle')), findsOneWidget);
    expect(find.byType(TabBar), findsOneWidget);
  });
}
