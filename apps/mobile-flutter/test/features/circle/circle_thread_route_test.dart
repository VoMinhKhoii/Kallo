import 'package:flutter/cupertino.dart' show CupertinoPage;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/logic/circle_thread_route.dart';

/// Does `/circle/thread/:shareId` — a ROOT route — actually win when pushed
/// from the `/circle` shell branch, and does the scope survive the URL?
///
/// The real `routerProvider` is Supabase-bound, so this mirrors its shape the
/// way `test/shell/nav_actions_test.dart` does: a StatefulShellRoute with a
/// `/circle` branch, plus the thread route declared outside it with a root
/// `parentNavigatorKey`, exactly as `router.dart` declares it. The one real
/// piece of the diff under test is [openCircleThread].
final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

GoRouter _router() => GoRouter(
  navigatorKey: _rootKey,
  initialLocation: '/circle',
  routes: [
    GoRoute(
      path: '/circle/thread/:shareId',
      parentNavigatorKey: _rootKey,
      pageBuilder: (context, state) => CupertinoPage<void>(
        child: Scaffold(
          body: Text(
            'thread ${state.pathParameters['shareId']} '
            'scope=${state.uri.queryParameters['scope']}',
          ),
        ),
      ),
    ),
    StatefulShellRoute.indexedStack(
      parentNavigatorKey: _rootKey,
      builder: (_, _, shell) => Scaffold(body: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/circle',
              builder: (_, _) => Builder(
                builder: (context) => TextButton(
                  onPressed: () => openCircleThread(
                    context,
                    shareId: 's1',
                    scope: 'group 1/+ü',
                  ),
                  child: const Text('circle'),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  ],
);

void main() {
  testWidgets('the reply glyph pushes the thread over the circle branch', (
    tester,
  ) async {
    final router = _router();
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    expect(find.text('circle'), findsOneWidget);

    await tester.tap(find.text('circle'));
    await tester.pumpAndSettle();

    // Matched the ROOT thread route, not the /circle branch as a prefix — and
    // the scope round-tripped through encode/decode byte for byte.
    expect(find.text('thread s1 scope=group 1/+ü'), findsOneWidget);
    expect(find.text('circle'), findsNothing);

    // It was a push: back returns to the branch, untouched.
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('circle'), findsOneWidget);
  });

  test('the thread URL omits the scope for the friends feed', () {
    expect(circleThreadLocation(shareId: 's1'), '/circle/thread/s1');
    expect(
      circleThreadLocation(shareId: 's 1', scope: 'g/1'),
      '/circle/thread/s%201?scope=g%2F1',
    );
  });
}
