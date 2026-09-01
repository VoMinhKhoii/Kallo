import 'package:flutter/cupertino.dart' show CupertinoPage;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/shell/nav/nav_actions.dart';

/// Opening the logging feed must PRESERVE the tab the user was on.
///
/// The "+" sheet lives on the pill nav, which is on every shell branch, and it
/// used to `go('/dashboard')` before pushing `/logging` — so logging a meal
/// from Nutrition or Circle silently rewrote the stack to Today and back
/// dropped the user there. The reset belongs only to callers OUTSIDE the
/// shell (welcome, paywall, a Settings deep action), which have no branch to
/// come back to.
GoRouter _router() => GoRouter(
  initialLocation: '/dashboard',
  routes: [
    GoRoute(
      path: '/welcome',
      builder: (_, _) => const Scaffold(body: Text('welcome-page')),
    ),
    GoRoute(
      path: '/logging',
      pageBuilder: (_, _) =>
          const CupertinoPage<void>(child: Scaffold(body: Text('logging-page'))),
    ),
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => Scaffold(body: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/dashboard', builder: (_, _) => const Text('dash')),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/circle', builder: (_, _) => const Text('circle')),
          ],
        ),
      ],
    ),
  ],
);

Future<GoRouter> _pump(WidgetTester tester) async {
  final router = _router();
  addTearDown(router.dispose);
  await tester.pumpWidget(MaterialApp.router(routerConfig: router));
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('from a shell branch, logging pushes over that branch', (
    tester,
  ) async {
    final router = await _pump(tester);
    router.go('/circle');
    await tester.pumpAndSettle();
    expect(find.text('circle'), findsOneWidget);

    // Exactly what the "+" sheet's submit does: pop itself, then hand the
    // router to the one logging entry point.
    openLogging(router);
    await tester.pumpAndSettle();
    expect(find.text('logging-page'), findsOneWidget);

    router.pop();
    await tester.pumpAndSettle();
    expect(
      find.text('circle'),
      findsOneWidget,
      reason: 'back must return to the branch the user logged from',
    );
    expect(find.text('dash'), findsNothing, reason: 'the tab was reset');
  });

  testWidgets('from outside the shell, logging still lands on Today first', (
    tester,
  ) async {
    final router = await _pump(tester);
    router.go('/welcome');
    await tester.pumpAndSettle();
    expect(find.text('welcome-page'), findsOneWidget);

    openLogging(router);
    await tester.pumpAndSettle();
    expect(find.text('logging-page'), findsOneWidget);

    // Welcome/paywall have nothing to go back to, so the feed must sit over
    // Today rather than over a screen the user has finished with.
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('dash'), findsOneWidget);
    expect(find.text('welcome-page'), findsNothing);
  });
}
