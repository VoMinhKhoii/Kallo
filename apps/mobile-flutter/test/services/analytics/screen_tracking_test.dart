import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/services/analytics/screen_tracking.dart';

void main() {
  GoRouter buildRouter() => GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SizedBox()),
      GoRoute(
        path: '/circle',
        builder: (_, _) => const SizedBox(),
        routes: [
          GoRoute(path: 'invite/:slug', builder: (_, _) => const SizedBox()),
          GoRoute(path: ':shareId', builder: (_, _) => const SizedBox()),
        ],
      ),
    ],
  );

  testWidgets('names a screen by its route pattern, never the location', (
    tester,
  ) async {
    final router = buildRouter();
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));

    router.go('/circle/invite/secret-slug');
    await tester.pumpAndSettle();
    expect(
      screenPattern(router.routerDelegate.currentConfiguration),
      '/circle/invite/:slug',
    );

    router.go('/circle/share-123');
    await tester.pumpAndSettle();
    expect(
      screenPattern(router.routerDelegate.currentConfiguration),
      '/circle/:shareId',
    );
  });

  test('nothing matched yet → no screen name', () {
    expect(screenPattern(RouteMatchList.empty), isNull);
  });
}
