import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/shell/launch/route_settled.dart';

GoRouter _router({String? Function(String location)? redirect}) => GoRouter(
  initialLocation: '/',
  redirect: (context, state) => redirect?.call(state.matchedLocation),
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SizedBox()),
    GoRoute(path: '/dashboard', builder: (context, state) => const SizedBox()),
  ],
);

void main() {
  testWidgets('is not settled while the router holds the index route', (
    tester,
  ) async {
    final router = _router();
    final settled = RouteSettled(router);
    addTearDown(settled.dispose);
    expect(settled.value, isFalse);

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    expect(settled.value, isFalse);

    router.go('/dashboard');
    await tester.pumpAndSettle();
    expect(settled.value, isTrue);
  });

  testWidgets('a redirect straight past the index counts as settled', (
    tester,
  ) async {
    final router = _router(redirect: (at) => at == '/' ? '/dashboard' : null);
    final settled = RouteSettled(router);
    addTearDown(settled.dispose);
    var notified = 0;
    settled.addListener(() => notified++);

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(settled.value, isTrue);
    expect(notified, 1);
  });
}
