import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_ui_state.dart';

/// The Log screen is a full-screen push (native pass): its widget tree dies on
/// every pop. State a user would call "mine" — the composer draft, which cards
/// they opened — must therefore live in the app-lifetime container, not the
/// route (TestFlight regression, 2026-08-31).
void main() {
  testWidgets('the composer draft survives the Log route being popped', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    Widget screen() => UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Scaffold(
          body: Consumer(
            builder: (context, ref, _) => TextField(
              controller: ref.watch(composerControllerProvider),
            ),
          ),
        ),
      ),
    );

    await tester.pumpWidget(screen());
    await tester.enterText(find.byType(TextField), 'bún chả half eaten');

    // Pop the route: the whole subtree unmounts…
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: SizedBox.shrink()),
      ),
    );
    // …and a fresh visit still holds the draft, on a live (undisposed)
    // controller.
    await tester.pumpWidget(screen());
    expect(find.text('bún chả half eaten'), findsOneWidget);
    expect(
      container.read(composerControllerProvider).text,
      'bún chả half eaten',
    );
  });

  test('expanded-card ids persist in the container', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(expandedMealCardsProvider.notifier).state = {'m1'};
    expect(container.read(expandedMealCardsProvider), contains('m1'));
  });
}
