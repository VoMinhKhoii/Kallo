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
          'type': 'group.added',
          'targetType': 'chat_group',
          'targetId': 'g-1',
        }),
        const PushDestination(path: '/circle', groupId: 'g-1'),
      );
    });

    test('chat.message opens the group, flat APNs payload included', () {
      // The server's fields sit beside `aps` at the top level — the only shape.
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

    test('a share event opens the thread for that share', () {
      // The three thread-bearing types, routed by the `objectType` the
      // producers stamp on them rather than by a copy of this list in the app
      // (`lib/actions/meal-sharing/{reactions,replies,log-shared}.ts`).
      for (final type in const [
        'share.reaction',
        'share.reply',
        'share.logged',
      ]) {
        expect(
          pushDestinationFor({
            'type': type,
            'objectType': 'share',
            'objectId': 's1',
          }),
          const PushDestination(path: '/circle/s1'),
          reason: type,
        );
      }
    });

    test('the share id is URL-encoded into the thread path', () {
      expect(
        pushDestinationFor({
          'type': 'share.reply',
          'objectType': 'share',
          'objectId': 'a b/c',
        }),
        const PushDestination(path: '/circle/a%20b%2Fc'),
      );
    });

    test('a share event with no usable share id still lands on circle', () {
      expect(
        pushDestinationFor({'type': 'share.reply', 'objectType': 'share'}),
        const PushDestination(path: '/circle'),
      );
      expect(
        pushDestinationFor({
          'type': 'share.reply',
          'objectType': 'meal',
          'objectId': 'm-1',
        }),
        const PushDestination(path: '/circle'),
      );
    });

    test('every other catalog type lands on circle', () {
      // These carry no share to open, so the feed itself is the destination.
      for (final type in const [
        'friend.joined',
        'share.invite',
        'share.invite_accepted',
      ]) {
        expect(
          pushDestinationFor({'type': type}),
          const PushDestination(path: '/circle'),
          reason: type,
        );
      }
    });

    test('a share.invite carries an invite, not a thread', () {
      // The one `share.`-prefixed type with no thread behind it: the producer
      // stamps `objectType: 'invite'` (`lib/actions/meal-sharing/
      // share-with-friends.ts`), and routing on that discriminant is what
      // keeps this tap on the feed rather than on `/circle/<invite id>`.
      expect(
        pushDestinationFor({
          'type': 'share.invite',
          'objectType': 'invite',
          'objectId': 'inv-1',
        }),
        const PushDestination(path: '/circle'),
      );
    });

    test('a group event without a target still lands on circle', () {
      expect(
        pushDestinationFor({'type': 'group.added'}),
        const PushDestination(path: '/circle'),
      );
    });

    test('unknown, reserved and missing types route nowhere', () {
      expect(pushDestinationFor(const {}), isNull);
      expect(pushDestinationFor({'type': 'coach.nudge'}), isNull);
      expect(
        pushDestinationFor({'type': 'not.a.type', 'targetId': 'g-9'}),
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
        GoRoute(
          path: '/circle/:shareId',
          builder: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );

    // A thread tap now PUSHES over a seeded `/circle`, and a push only reaches
    // the delegate through the (async) route parse — which needs a widget tree.
    // So these pump one and read the router's own settled state, rather than
    // the route-information provider `go()` used to update synchronously.
    Future<void> pump(WidgetTester tester, GoRouter router) async {
      await tester.pumpWidget(
        WidgetsApp.router(
          routerConfig: router,
          color: const Color(0xFF000000),
        ),
      );
      await tester.pumpAndSettle();
    }

    String locationOf(GoRouter router) => router.state.matchedLocation;

    testWidgets('a group tap selects the group and navigates to circle', (
      tester,
    ) async {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {'type': 'chat.message', 'targetId': 'g-7'});
      await tester.pumpAndSettle();

      expect(container.read(circleSelectedViewProvider), 'g-7');
      expect(locationOf(router), '/circle');
      // A shell branch is a branch SWITCH, so there is nothing stacked over it.
      expect(router.canPop(), isFalse);
    });

    testWidgets('a share tap clears nothing and lands on circle', (
      tester,
    ) async {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {'type': 'share.reaction'});
      await tester.pumpAndSettle();

      expect(container.read(circleSelectedViewProvider), isNull);
      expect(locationOf(router), '/circle');
    });

    testWidgets('a share tap after a group tap returns to the combined feed', (
      tester,
    ) async {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {'type': 'group.added', 'targetId': 'g-1'});
      await tester.pumpAndSettle();
      expect(container.read(circleSelectedViewProvider), 'g-1');

      routePushTap(container, {'type': 'share.reply'});
      await tester.pumpAndSettle();
      expect(container.read(circleSelectedViewProvider), isNull);
    });

    testWidgets('a share tap opens the thread page OVER the circle feed', (
      tester,
    ) async {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {'type': 'group.added', 'targetId': 'g-1'});
      await tester.pumpAndSettle();
      expect(container.read(circleSelectedViewProvider), 'g-1');

      routePushTap(container, {
        'type': 'share.reply',
        'objectType': 'share',
        'objectId': 's1',
      });
      await tester.pumpAndSettle();

      // The thread reads its post out of the combined feed, so the earlier
      // group scope has to be cleared along with the navigation.
      expect(container.read(circleSelectedViewProvider), isNull);
      expect(locationOf(router), '/circle/s1');
      // The point of the seed: `/circle` is underneath, so the back GESTURE
      // has somewhere to go instead of only the chevron's popOr fallback.
      expect(router.canPop(), isTrue);
    });

    testWidgets('a cold thread tap still seeds the feed underneath', (
      tester,
    ) async {
      // The cold case the old `go` existed for: nothing has been navigated
      // yet, so there is no shell to push over.
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {
        'type': 'share.reply',
        'objectType': 'share',
        'objectId': 's9',
      });
      await tester.pumpAndSettle();

      expect(locationOf(router), '/circle/s9');
      expect(router.canPop(), isTrue);
    });

    testWidgets('an unroutable payload is a no-op', (tester) async {
      final router = testRouter();
      addTearDown(router.dispose);
      final container = containerWith(router);
      await pump(tester, router);

      routePushTap(container, {'type': 'streak.milestone'});
      await tester.pumpAndSettle();

      expect(locationOf(router), '/dashboard');
      expect(router.canPop(), isFalse);
    });
  });
}
