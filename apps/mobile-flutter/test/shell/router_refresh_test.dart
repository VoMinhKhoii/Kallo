import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/shell/nav/router_refresh.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthChangeEvent, AuthState;

/// The TestFlight grey screen of 2026-09-11.
///
/// A production build died with a `ConcurrentModificationError` over an
/// element's dependency HashMap, thrown from
/// `ProviderScheduler._performRefresh` → `ProviderElementBase.flush` →
/// `visitAncestors`, on the path where a user completes onboarding and then
/// signs in with Apple/Google. These pin the two facts that produced it and
/// the one property of [RouterRefresh] that closes it.
void main() {
  group('the hazard this defers around', () {
    testWidgets('go_router runs its redirect inside notifyListeners', (
      tester,
    ) async {
      // The first half: a `refreshListenable` notification re-parses in the
      // NOTIFIER'S OWN STACK FRAME, because a synchronous `redirect` reaches
      // go_router's parser as a `SynchronousFuture`. So whatever the redirect
      // touches, it touches from wherever notifyListeners was called.
      final refresh = ChangeNotifier();
      addTearDown(refresh.dispose);
      var redirects = 0;

      final router = GoRouter(
        initialLocation: '/a',
        refreshListenable: refresh,
        redirect: (context, state) {
          redirects += 1;
          return null;
        },
        routes: [
          for (final path in const ['/a', '/b'])
            GoRoute(path: path, builder: (_, _) => const SizedBox()),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        WidgetsApp.router(routerConfig: router, color: const Color(0xFF000000)),
      );
      await tester.pumpAndSettle();

      final before = redirects;
      // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
      refresh.notifyListeners();
      expect(
        redirects,
        greaterThan(before),
        reason: 'redirect ran before notifyListeners returned',
      );
    });

    test('a synchronous provider read during a flush throws', () async {
      // The second half, in miniature: `x` is scheduled for refresh AND has an
      // ancestor that is itself stale, so the scheduler flushes `x` by
      // iterating its dependency map and flushing each ancestor in turn. A
      // listener that synchronously reads `x` from inside that ancestor's
      // rebuild re-enters x's build, which swaps and prunes the very map the
      // scheduler is walking.
      //
      // This is the app's shape exactly: `router.dart` pings the refresh
      // listenable from four `ref.listen` callbacks, and the redirect it runs
      // reads seven providers. An UNDEFERRED ping is this test.
      // The error surfaces UNCAUGHT, out of riverpod's own scheduler task —
      // which is why in production it reached the build phase and killed the
      // screen instead of failing a call.
      expect(
        await _flushWithReentrantRead(sync: true),
        isA<ConcurrentModificationError>(),
      );
    });
  });

  group('RouterRefresh', () {
    late StreamController<AuthState> events;
    late RouterRefresh refresh;
    late int notifications;

    setUp(() {
      events = StreamController<AuthState>.broadcast();
      refresh = RouterRefresh(events.stream)
        ..addListener(() => notifications += 1);
      notifications = 0;
    });

    tearDown(() {
      refresh.dispose();
      events.close();
    });

    test('ping does not notify inside the caller stack frame', () async {
      refresh.ping();
      expect(notifications, 0, reason: 'the whole point');

      await Future<void>.value();
      expect(notifications, 1);
    });

    test('pings in one turn collapse into a single redirect', () async {
      refresh
        ..ping()
        ..ping()
        ..ping()
        ..ping();

      await Future<void>.value();
      expect(notifications, 1);

      // …and the next turn can ping again.
      refresh.ping();
      await Future<void>.value();
      expect(notifications, 2);
    });

    test('an auth event notifies, off the stack that emitted it', () async {
      events.add(const AuthState(AuthChangeEvent.signedOut, null));
      expect(notifications, 0);

      await Future<void>.delayed(Duration.zero);
      expect(notifications, 1);
    });

    test('a ping in flight is dropped by dispose', () async {
      refresh.ping();
      refresh.dispose();

      await Future<void>.value();
      expect(notifications, 0);

      // dispose() is idempotent for the tearDown above.
      refresh = RouterRefresh(events.stream);
    });

    test('the flush re-entrancy does not survive the deferral', () async {
      // The same graph as the hazard test, with the read arriving through
      // RouterRefresh instead of straight off the listener.
      expect(await _flushWithReentrantRead(sync: false), isNull);
    });
  });
}

/// The provider graph that reproduces the crash, read either straight from the
/// listener ([sync]) or through a [RouterRefresh]. Returns the uncaught error
/// the scheduler raised, or null if it ran clean.
///
/// `x` watches `a` and `b`; `a` watches `root`. Invalidating `x` schedules it,
/// and changing `root` marks x's dependencies as maybe-changed — so the
/// scheduler flushes `x` by walking its dependency map. Rebuilding `a` fires
/// the listener, which reads `x` back.
Future<Object?> _flushWithReentrantRead({required bool sync}) async {
  final root = StateProvider<int>((ref) => 0);
  final a = Provider<int>((ref) => ref.watch(root));
  final b = Provider<int>((ref) => 100);
  final x = Provider<int>((ref) => ref.watch(a) + ref.watch(b));

  final container = ProviderContainer();
  final events = StreamController<AuthState>.broadcast();
  final refresh = RouterRefresh(events.stream);
  // Stands in for go_router's synchronous re-parse + redirect.
  refresh.addListener(() => container.read(x));

  Object? uncaught;
  await runZonedGuarded(() async {
    container.listen(x, (_, _) {}, fireImmediately: true);
    container.listen(a, (_, _) {
      if (sync) {
        container.read(x);
      } else {
        refresh.ping();
      }
    });

    container.invalidate(x);
    container.read(root.notifier).state = 1;

    // Two turns: one for riverpod's scheduler, one for the deferred ping.
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
  }, (error, _) => uncaught ??= error);

  refresh.dispose();
  await events.close();
  try {
    container.dispose();
  } catch (_) {
    // The crash leaves riverpod's scheduler holding a completed task
    // completer, so tearing the container down throws on top of it. That is
    // the damage being asserted, not a second failure.
  }
  return uncaught;
}
