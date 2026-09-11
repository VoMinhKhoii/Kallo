// Seeding a branch and pushing over it — the shape the first run's hand-off,
// the paywall's exits and a cold notification tap all depend on.
//
// `GoRouter.push` reads its base synchronously while `go` reaches the delegate
// only after the async route parse, so `go(base); push(path);` built the push
// on the stack it was standing on. On device that landed as a bare grey screen
// after "Đang thiết lập tài khoản" — no route rendering at all — and only an
// app restart cleared it.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/shell/nav/nav_actions.dart';

void main() {
  GoRouter routerAt(String initial) => GoRouter(
    initialLocation: initial,
    routes: [
      for (final path in const [
        '/welcome',
        '/paywall',
        '/dashboard',
        '/circle',
        '/logging',
        '/circle/thread/1',
      ])
        GoRoute(
          path: path,
          builder: (_, _) =>
              Center(child: Text(path, textDirection: TextDirection.ltr)),
        ),
    ],
  );

  Future<GoRouter> pump(WidgetTester tester, String initial) async {
    final router = routerAt(initial);
    addTearDown(router.dispose);
    await tester.pumpWidget(
      WidgetsApp.router(routerConfig: router, color: const Color(0xFF000000)),
    );
    await tester.pumpAndSettle();
    return router;
  }

  List<String> stackOf(GoRouter router) => router
      .routerDelegate
      .currentConfiguration
      .matches
      .map((m) => m.matchedLocation)
      .toList();

  testWidgets('from OFF the shell it seeds the branch and lands on the push', (
    tester,
  ) async {
    // `/welcome` — the first run's hand-off, and the case that broke.
    final router = await pump(tester, '/welcome');

    pushOverShell(router, base: '/dashboard', path: '/logging');
    await tester.pumpAndSettle();

    // Both, in order: the seed is what back has to land on, and the push is
    // what the user asked to see. Losing either is the bug.
    expect(stackOf(router), ['/dashboard', '/logging']);
    expect(find.text('/logging'), findsOneWidget);
    expect(router.canPop(), isTrue, reason: 'back has the branch to go to');
  });

  testWidgets('the destination actually renders — no bare navigator', (
    tester,
  ) async {
    // The device symptom was a grey screen: a stack whose top page had been
    // wiped out from under the navigator, so nothing painted at all.
    final router = await pump(tester, '/paywall');

    pushOverShell(router, base: '/dashboard', path: '/logging');
    await tester.pumpAndSettle();

    expect(find.text('/logging'), findsOneWidget);
    expect(find.text('/paywall'), findsNothing, reason: 'the seed replaced it');
  });

  testWidgets('from ON the shell it pushes straight over the branch', (
    tester,
  ) async {
    // The pill nav's Log item. One call, no seed — this path never broke, and
    // it must keep the branch it is standing on rather than resetting to the
    // base (logging from Circle used to drop the user on Today).
    final router = await pump(tester, '/circle');

    pushOverShell(router, base: '/dashboard', path: '/logging');
    await tester.pumpAndSettle();

    expect(stackOf(router), ['/circle', '/logging']);
  });

  testWidgets('a shell branch destination is a branch switch, not a push', (
    tester,
  ) async {
    final router = await pump(tester, '/welcome');

    pushOverShell(router, base: '/circle', path: '/dashboard');
    await tester.pumpAndSettle();

    expect(stackOf(router), ['/dashboard']);
    expect(router.canPop(), isFalse);
  });

  testWidgets('already there is a no-op, so a double fire cannot stack two', (
    tester,
  ) async {
    final router = await pump(tester, '/welcome');

    pushOverShell(router, base: '/dashboard', path: '/logging');
    await tester.pumpAndSettle();
    // Two taps on the pill's Log item, or a tap plus a deep link.
    pushOverShell(router, base: '/dashboard', path: '/logging');
    await tester.pumpAndSettle();

    expect(stackOf(router), ['/dashboard', '/logging']);
  });

  testWidgets('a notification thread seeds Circle under it', (tester) async {
    final router = await pump(tester, '/welcome');

    pushOverShell(router, base: '/circle', path: '/circle/thread/1');
    await tester.pumpAndSettle();

    expect(stackOf(router), ['/circle', '/circle/thread/1']);
    expect(router.canPop(), isTrue, reason: 'the back gesture has a target');
  });
}
