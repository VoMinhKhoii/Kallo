import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/notifications/logic/push_tap_routing.dart';
import 'package:kallo_mobile/router.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('pushDestinationFor', () {
    test('group.added opens the tapped group', () {
      expect(
        pushDestinationFor({
          'data': {
            'type': 'group.added',
            'targetType': 'chat_group',
            'targetId': 'g-1',
          },
        }),
        const PushDestination(path: '/circle', groupId: 'g-1'),
      );
    });

    test('chat.message opens the group, flat APNs payload included', () {
      // APNs delivers the FCM `data` map as siblings of `aps`, not nested.
      expect(
        pushDestinationFor({
          'aps': {'alert': 'hi'},
          'type': 'chat.message',
          'targetType': 'chat_group',
          'targetId': 'g-2',
        }),
        const PushDestination(path: '/circle', groupId: 'g-2'),
      );
    });

    test('every other catalog type lands on circle', () {
      for (final type in const [
        'friend.joined',
        'share.invite',
        'share.invite_accepted',
        'share.reaction',
        'share.reply',
        'share.logged',
      ]) {
        expect(
          pushDestinationFor({
            'data': {'type': type},
          }),
          const PushDestination(path: '/circle'),
          reason: type,
        );
      }
    });

    test('a group event without a target still lands on circle', () {
      expect(
        pushDestinationFor({
          'data': {'type': 'group.added'},
        }),
        const PushDestination(path: '/circle'),
      );
    });

    test('unknown, reserved and missing types route nowhere', () {
      expect(pushDestinationFor(const {}), isNull);
      expect(
        pushDestinationFor({
          'data': {'type': 'coach.nudge'},
        }),
        isNull,
      );
      expect(
        pushDestinationFor({
          'data': {'type': 'not.a.type', 'targetId': 'g-9'},
        }),
        isNull,
      );
      expect(pushDestinationFor({'type': 42}), isNull);
    });
  });

  group('routePushTap', () {
    ProviderContainer containerWith(GoRouter router) {
      final container = ProviderContainer(
        overrides: [routerProvider.overrideWithValue(router)],
      );
      addTearDown(container.dispose);
      return container;
    }

    GoRouter testRouter() => GoRouter(
      initialLocation: '/dashboard',
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (_, __) => const SizedBox.shrink(),
        ),
        GoRoute(path: '/circle', builder: (_, __) => const SizedBox.shrink()),
      ],
    );

    // Read the route information rather than the delegate's configuration:
    // `go()` updates this synchronously, while the delegate only settles after
    // the (async) route parse, which never runs without a widget tree.
    String locationOf(GoRouter router) =>
        router.routeInformationProvider.value.uri.toString();

    test('a group tap selects the group and navigates to circle', () {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);

      routePushTap(container, {
        'data': {'type': 'chat.message', 'targetId': 'g-7'},
      });

      expect(container.read(circleSelectedViewProvider), 'g-7');
      expect(locationOf(router), '/circle');
    });

    test('a share tap clears nothing and lands on circle', () {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);

      routePushTap(container, {
        'data': {'type': 'share.reaction'},
      });

      expect(container.read(circleSelectedViewProvider), isNull);
      expect(locationOf(router), '/circle');
    });

    test('an unroutable payload is a no-op', () {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);

      routePushTap(container, {
        'data': {'type': 'streak.milestone'},
      });

      expect(locationOf(router), '/dashboard');
    });
  });
}
