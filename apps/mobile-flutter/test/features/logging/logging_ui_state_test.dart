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

  test('an account switch resets the draft and the expansion set', () {
    // Sticky state outliving the ROUTE is the fix; outliving the ACCOUNT on a
    // shared device would be a leak (CodeRabbit, PR #329).
    final owner = StateProvider<String?>((ref) => 'user-a');
    final container = ProviderContainer(
      overrides: [
        loggingUiOwnerProvider.overrideWith((ref) => ref.watch(owner)),
      ],
    );
    addTearDown(container.dispose);

    final first = container.read(composerControllerProvider)
      ..text = 'gà nướng';
    container.read(expandedMealCardsProvider.notifier).state = {'m1'};

    container.read(owner.notifier).state = 'user-b';

    final second = container.read(composerControllerProvider);
    expect(identical(first, second), isFalse,
        reason: 'the next account gets a fresh controller');
    expect(second.text, isEmpty);
    expect(container.read(expandedMealCardsProvider), isEmpty);
  });
}
