import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// The pre-auth flow's HISTORY, which is what the back gesture runs on.
///
/// `/start` used to `go` to both of its destinations, so `/onboarding` and
/// `/sign-in` each sat alone on the stack: the wizard's screen-1 chevron had to
/// rebuild `/start` from scratch, and the sign-in face had no way back at all.
/// These pin the shape rather than the screens — `router_redirect_test.dart`
/// already owns the rule itself, and pumping the real wizard here would test
/// six screens of onboarding to assert one `canPop`.
void main() {
  var signedIn = false;

  GoRouter routerFor(ValueNotifier<int> refresh) => GoRouter(
    initialLocation: '/start',
    refreshListenable: refresh,
    // The shape of `resolveRedirect` this flow depends on: a signed-OUT user is
    // left alone on any pre-auth route, and signing in sends them to /welcome.
    redirect: (context, state) {
      const preAuth = {'/start', '/onboarding', '/save-plan', '/sign-in'};
      final loc = state.matchedLocation;
      if (!signedIn) return null;
      return preAuth.contains(loc) ? '/welcome' : null;
    },
    routes: [
      for (final path in const [
        '/start',
        '/onboarding',
        '/save-plan',
        '/sign-in',
        '/welcome',
        '/dashboard',
      ])
        GoRoute(
          path: path,
          builder: (_, _) => Center(child: Text(path, textDirection: TextDirection.ltr)),
        ),
    ],
  );

  Future<GoRouter> pump(WidgetTester tester) async {
    signedIn = false;
    final refresh = ValueNotifier<int>(0);
    addTearDown(refresh.dispose);
    final router = routerFor(refresh);
    addTearDown(router.dispose);
    await tester.pumpWidget(
      WidgetsApp.router(routerConfig: router, color: const Color(0xFF000000)),
    );
    await tester.pumpAndSettle();
    return router;
  }

  Future<void> signIn(WidgetTester tester, GoRouter router) async {
    signedIn = true;
    router.refresh();
    await tester.pumpAndSettle();
  }

  testWidgets('"Get started" leaves /start under the wizard', (tester) async {
    final router = await pump(tester);

    router.push('/onboarding');
    await tester.pumpAndSettle();

    expect(router.state.matchedLocation, '/onboarding');
    expect(router.canPop(), isTrue);

    router.pop();
    await tester.pumpAndSettle();
    expect(router.state.matchedLocation, '/start');
  });

  testWidgets('"I already have an account" leaves /start under sign-in', (
    tester,
  ) async {
    final router = await pump(tester);

    router.push('/sign-in');
    await tester.pumpAndSettle();

    // This is what the sign-in chevron gates on: with nothing to pop it hides
    // itself rather than offering a button that does nothing.
    expect(router.canPop(), isTrue);
  });

  testWidgets('sign-in reached cold has nothing to pop, so no chevron', (
    tester,
  ) async {
    final router = await pump(tester);

    router.go('/sign-in');
    await tester.pumpAndSettle();

    expect(router.canPop(), isFalse);
  });

  testWidgets('the wizard stacks: /start → /onboarding → /save-plan', (
    tester,
  ) async {
    final router = await pump(tester);

    router.push('/onboarding');
    await tester.pumpAndSettle();
    router.push('/save-plan');
    await tester.pumpAndSettle();

    expect(router.canPop(), isTrue);
    router.pop();
    await tester.pumpAndSettle();
    // Back onto the LIVE wizard, not a rebuilt one.
    expect(router.state.matchedLocation, '/onboarding');
  });

  testWidgets('signing in on /save-plan clears the whole pre-auth stack', (
    tester,
  ) async {
    final router = await pump(tester);
    router.push('/onboarding');
    await tester.pumpAndSettle();
    router.push('/save-plan');
    await tester.pumpAndSettle();
    expect(router.canPop(), isTrue);

    await signIn(tester, router);

    // The redirect re-parses the location into a fresh match list, which drops
    // the pushed entries — so /welcome cannot be swiped back into the wizard by
    // someone who already has an account. Nothing guards this in our code; it
    // is go_router's behaviour, and this test is what would catch it changing.
    expect(router.state.matchedLocation, '/welcome');
    expect(router.canPop(), isFalse);
  });
}
